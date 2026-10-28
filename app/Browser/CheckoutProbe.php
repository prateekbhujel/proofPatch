<?php

declare(strict_types=1);

namespace ProofPatch\Browser;

use Facebook\WebDriver\Chrome\ChromeOptions;
use Facebook\WebDriver\Remote\DriverCommand;
use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;

final class CheckoutProbe
{
    public function __construct(private readonly string $driver, private readonly ?string $browser = null)
    {
    }

    public function inspect(string $url, string $screenshot, int $x = 420, int $y = 320): array
    {
        $parts = parse_url($url);
        if (($parts['scheme'] ?? '') !== 'http' || ($parts['host'] ?? '') !== '127.0.0.1'
            || isset($parts['user']) || isset($parts['pass'])) {
            throw new \InvalidArgumentException('Only local HTTP fixtures are supported.');
        }
        if ($x < 0 || $x >= 1280 || $y < 0 || $y >= 720) {
            throw new \InvalidArgumentException('Point is outside the fixed viewport.');
        }

        $port = stream_socket_server('tcp://127.0.0.1:0', $errorCode, $errorMessage);
        if ($port === false) {
            throw new \RuntimeException($errorMessage, $errorCode);
        }
        $driverPort = (int) substr(strrchr(stream_socket_get_name($port, false), ':'), 1);
        fclose($port);

        $capabilities = [];
        if ($this->browser !== null) {
            $options = new ChromeOptions();
            $options->setBinary($this->browser);
            $capabilities[ChromeOptions::CAPABILITY] = $options;
        }
        $client = Client::createChromeClient($this->driver, [
            '--headless=new', '--window-size=1280,720', '--force-device-scale-factor=1',
            '--disable-background-networking', '--disable-default-apps', '--no-first-run',
        ], ['port' => $driverPort, 'capabilities' => $capabilities]);

        try {
            $client->request('GET', $url);
            $driver = $client->getWebDriver();
            $driver->executeCustomCommand('/session/:sessionId/goog/cdp/execute', 'POST', [
                'cmd' => 'Emulation.setDeviceMetricsOverride',
                'params' => ['width' => 1280, 'height' => 720, 'deviceScaleFactor' => 1, 'mobile' => false],
            ]);
            $driver->navigate()->refresh();
            $client->waitForVisibility('#shipping-selected');
            $initial = $driver->findElement(WebDriverBy::id('shipping-selected'))->getText();
            $stack = $driver->executeScript(<<<'JS'
                return document.elementsFromPoint(arguments[0], arguments[1]).slice(0, 5).map(el => {
                    const box = el.getBoundingClientRect(), css = getComputedStyle(el);
                    return {tag: el.tagName, id: el.id, class: el.className, pointerEvents: css.pointerEvents,
                        zIndex: css.zIndex, rect: {x: box.x, y: box.y, width: box.width, height: box.height}};
                });
                JS, [$x, $y]);
            $driver->execute(DriverCommand::ACTIONS, ['actions' => [[
                'type' => 'pointer', 'id' => 'checkout-pointer', 'parameters' => ['pointerType' => 'mouse'],
                'actions' => [
                    ['type' => 'pointerMove', 'origin' => 'viewport', 'x' => $x, 'y' => $y, 'duration' => 0],
                    ['type' => 'pointerDown', 'button' => 0], ['type' => 'pointerUp', 'button' => 0],
                ],
            ]]]);
            $selected = $driver->findElement(WebDriverBy::id('shipping-selected'))->getText();
            $pointer = $driver->executeScript('return window.lastPointer;');
            $banner = $driver->executeScript(<<<'JS'
                const el = document.querySelector('#promo-banner'), css = getComputedStyle(el), box = el.getBoundingClientRect();
                return {height: box.height, visible: box.height > 0 && css.display !== 'none' && css.visibility === 'visible' && Number(css.opacity) > 0};
                JS);
            if (!is_dir(dirname($screenshot)) && !mkdir(dirname($screenshot), 0700, true) && !is_dir(dirname($screenshot))) {
                throw new \RuntimeException('Cannot create screenshot directory.');
            }
            $client->takeScreenshot($screenshot);
            $neighborWorks = false;
            if ($banner['visible']) {
                $driver->findElement(WebDriverBy::id('promo-details'))->click();
                $neighborWorks = $driver->findElement(WebDriverBy::id('offer-feedback'))->getText() === 'Offer terms opened';
            }

            return [
                'initial' => $initial, 'selected' => $selected, 'pointer' => $pointer, 'hitStack' => $stack,
                'banner' => $banner, 'neighborWorks' => $neighborWorks,
                'viewport' => $driver->executeScript('return {width: innerWidth, height: innerHeight, scale: devicePixelRatio};'),
                'screenshotSha256' => hash_file('sha256', $screenshot),
            ];
        } finally {
            $client->quit();
        }
    }
}
