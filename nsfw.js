var useCached = true;
var template = null;

if (!window.location.search.includes("after")) {
    localStorage.setItem("seenItems", "[]");
    useCached = false;
}

var multiredditList = null;
chrome.storage.sync.get("multiredditUrl").then(data => {
    var url = data.multiredditUrl + ".json";
    if (!useCached) {
        fetch(url).then(response => {
            return response.json();
        }).then(json => {
            var list = json.data.children;
            for (var submission of list) {
                delete submission.data['preview'];
                delete submission.data['all_awardings'];
                delete submission.data['media'];
                delete submission.data['secure_media'];
                delete submission.data['media_embed'];
            }
            sessionStorage.setItem("cachedMultireddit", JSON.stringify(list));

            multiredditList = list;

            return getTemplate();
        });
    }

    multiredditList = JSON.parse(sessionStorage.getItem("cachedMultireddit"));
    return getTemplate();
}).then(template => {
    return template.text();
}).then(templateText => {
    var submissions = document.getElementsByClassName("thing");
    var submissionsCopy = Object.assign([], submissions);

    var seenItems = JSON.parse(localStorage.getItem("seenItems"));
    if (seenItems == null) {
        seenItems = [];
    }

    for (var j = 0; j < submissionsCopy.length; j++) {
        var sub = submissionsCopy[j];

        if (sub.getAttribute("data-promoted") == "true") {
            console.log("promoted");
            continue;
        }

        if (isNaN(scoreFromElement(sub)) || isNaN(dateFromElement(sub))) {
            console.log("isNaN");
            continue;
        }

        for (var i = 0; i < multiredditList.length; i++) {
            var nsfwSub = multiredditList[i];

            if (seenItems.includes(nsfwSub.data.id)) {
                continue;
            }

            var nsfwHotScore = hot(nsfwSub.data.ups, 0, nsfwSub.data.created_utc * 1000);
            var subHotScore = hot(scoreFromElement(sub), 0, dateFromElement(sub));

            if (nsfwHotScore > subHotScore) {
                console.log("NSFW All: Inserting submission: %s", nsfwSub.data.title);
                seenItems.push(nsfwSub.data.id);
                var nsfwSubHtml = templateText;
                for (var key in nsfwSub.data) {
                    nsfwSubHtml = nsfwSubHtml.replace(new RegExp("%" + key + "%", "g"), nsfwSub.data[key]);
                }

                nsfwSubHtml = nsfwSubHtml.replace("%timeSince%", timeSince(new Date(nsfwSub.data.created_utc * 1000)));

                var nsfwDate = new Date(nsfwSub.data.created_utc * 1000);
                var weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(nsfwDate);
                var month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(nsfwDate);
                var year = new Intl.DateTimeFormat("en-US", { year: "numeric" }).format(nsfwDate);
                var time = new Intl.DateTimeFormat("en-US", { 
                    hour: "numeric", minute: "numeric", second: "numeric", hour12: false, timeZone: "UTC" 
                }).format(nsfwDate);
                var day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(nsfwDate);
                var dateString = `${weekday} ${month} ${day} ${time} ${year} UTC`;
                nsfwSubHtml = nsfwSubHtml.replace("%date%", dateString);

                var newNsfwSubmission = document.createElement("template");
                newNsfwSubmission.innerHTML = nsfwSubHtml;
                newNsfwSubmission = newNsfwSubmission.content.firstChild;
                sub.parentNode.insertBefore(newNsfwSubmission, sub);

                multiredditList.splice(i, 1);
                i--;
            }
        }
    }

    localStorage.setItem("seenItems", JSON.stringify(seenItems));
});

function getTemplate() {
    var templateUrl = chrome.runtime.getURL("html/submission.html");
    return fetch(templateUrl);
}

function scoreFromElement(element) {
    var score = element.getElementsByClassName("score unvoted")[0].getAttribute("title");
    if (score == undefined) {
        return NaN;
    }

    return parseInt(score);
}

function dateFromElement(element) {
    return parseInt(element.getAttribute("data-timestamp"))
}

function hot(ups, downs, date) {
    date = date / 1000;
    var score = ups - downs;
    var order = Math.log10(Math.max(Math.abs(score), 1));
    var sign = score > 0 ? 1 : score < 0 ? -1 : 0;
    var seconds = date - 1134028003;

    return (sign * order + seconds / 45000).toFixed(7);
}

// https://stackoverflow.com/a/47006398
const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 }
];

function timeSince(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const interval = intervals.find(i => i.seconds < seconds);
    const count = Math.floor(seconds / interval.seconds);
    return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
}