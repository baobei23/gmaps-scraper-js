from botasaurus.browser import browser, Driver, AsyncQueueResult
from botasaurus.request import request, Request
import json

def extract_title(html):
    return json.loads(
        html.split(";window.APP_INITIALIZATION_STATE=")[1].split(";window.APP_FLAGS")[0]
    )[5][3][2][1]

@request(
    parallel=5,
    async_queue=True,
    max_retry=5,
)
def scrape_place_title(request: Request, link, metadata):
    cookies = metadata["cookies"]
    html = request.get(link, cookies=cookies, timeout=12).text
    title = extract_title(html)
    print("Title:", title)
    return title

def has_reached_end(driver):
    return driver.select('p.fontBodyMedium > span > span') is not None

def extract_links(driver):
    return driver.get_all_links('[role="feed"] > div > div > a')

@browser()
def scrape_google_maps(driver: Driver, link):
    link = data['link']
    driver.google_get(link, accept_google_cookies=True)  # accepts google cookies popup

    scrape_place_obj: AsyncQueueResult = scrape_place_title()  # initialize the async queue for scraping places
    cookies = driver.get_cookies_dict()  # get the cookies from the driver

    while True:
        links = extract_links(driver)  # get the links to places
        scrape_place_obj.put(links, metadata={"cookies": cookies})  # add the links to the async queue for scraping

        print("scrolling")
        driver.scroll_to_bottom('[role="feed"]')  # scroll to the bottom of the feed

        if has_reached_end(driver):  # we have reached the end, let's break buddy
            break

    results = scrape_place_obj.get()  # get the scraped results from the async queue
    return results

scrape_google_maps("https://www.google.com/maps/search/web+developers+in+bangalore")