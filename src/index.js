"use strict";
console.clear();

let baseURL = "https://covid19.mathdro.id/api/";
let barElement = document.getElementById("bar");
let countriesElement = document.querySelector(".countries");
let donutElement = document.getElementById("donut");
let idnElement = document.getElementById('donut-idn');

let monthsTable = {
    "01": "January",
    "02": "February",
    "03": "March",
    "04": "April",
    "05": "May",
    "06": "June",
    "07": "July",
    "08": "August",
    "09": "September",
    "10": "October",
    "11": "November",
    "12": "December",
};

async function fetchData(base, category) {
    return await fetch(`${base}${category}`).then(d => d.json());
}

async function createSelection() {
    let { countries, iso3 } = await fetchData(baseURL, "countries");
    Object.entries(countries).map(([country, iso2]) => {
        let option = `<option value=${iso3[iso2]}>${country}</option>`;
        countriesElement.insertAdjacentHTML("beforeend", option);
    });
}

async function createDailyBarChart() {
    let tooltip = document.getElementById("tooltip");
    let padding = 50;
    let width = 800;
    let height = 600;

    // GET DATA
    let data = await fetchData(baseURL, "daily");
    let barData = data.map(d => ({
        name: d.reportDateString,
        china: d.mainlandChina,
        other: d.otherLocations,
        total: d.totalConfirmed,
    }));
    let keys = ["china", "other"];
    let series = d3
        .stack()
        .keys(keys)(barData)
        .map(d => (d.forEach(v => (v.key = d.key)), d));
    let date = data.map(d => new Date(d.reportDateString));
    let total = data.map(d => d.totalConfirmed);
    let recovered = data.map(d => ({
        date: new Date(d.reportDateString),
        value: d.totalRecovered,
    }));

    // BAR
    let svg = d3
        .select(barElement)
        .append("svg")
        .attr("class", "bar-chart")
        .attr("width", width)
        .attr("height", height);

    // console.log(series);

    let xScale = d3
        .scaleTime()
        .domain([d3.min(date), d3.max(date)])
        .range([padding, width - padding]);

    let xAxis = d3.axisBottom(xScale);

    let yScale = d3
        .scaleLinear()
        .domain([d3.min(total), d3.max(total)])
        .range([height - padding, padding]);

    let yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .call(xAxis)
        .attr("transform", `translate(0, ${height - padding})`);
    svg.append("g")
        .call(yAxis)
        .attr("transform", `translate(${padding}, 0)`);

    // COLOR
    let colorScheme = [
        "#e41a1c",
        "#377eb8",
        "#4daf4a",
        "#984ea3",
        "#ff7f00",
        "#ffff33",
        "#a65628",
        "#f781bf",
        "#999999",
    ];
    let color = d3
        .scaleOrdinal()
        .domain(series.map(d => d.key))
        .range(colorScheme.slice(0, series.length))
        .unknown("#ccc");

    // APPEND BAR
    svg.append("g")
        .selectAll("g")
        .data(series)
        .join("g")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("class", "bar-rect")
        .attr("x", d => xScale(new Date(d.data.name)))
        .attr("y", d => yScale(d[1]))
        .attr("height", d => yScale(d[0]) - yScale(d[1]))
        .attr("width", d => width / series[0].length - 3)
        .on("mouseover", (d, i) => {
            // TOOLTIP
            let totalRecovered = data.filter(
                r => r.reportDateString === d.data.name
            )[0].totalRecovered;
            let total = d.data.china + d.data.other;
            let percentRecovered = ((totalRecovered / total) * 100).toFixed(2);
            tooltip.classList.add("show");
            tooltip.innerHTML = `
      <p>${monthsTable[d.data.name.slice(5, 7)]} ${d.data.name.slice(
                8
            )}, ${d.data.name.slice(0, 4)}</p>
      <p>Mainland China: ${numberFormat(d.data.china)} cases</p>
      <p>Rest of the world: ${numberFormat(d.data.other)} cases</p>
      <p>TOTAL: ${numberFormat(total)} cases</>
      <p>Recovered: ${numberFormat(
          totalRecovered
      )} cases - ${percentRecovered}%</p>
    `;
        })
        .on("mouseout", d => {
            tooltip.classList.remove("show");
        })
        .on("click", async d => {
            if (
                barElement.lastElementChild ===
                document.getElementById("sunburst")
            ) {
                barElement.removeChild(barElement.lastElementChild);
            }
            let dailyDonutSvg = await createDailyDonutChart(d.data.name);
            console.log("donutsvg:", dailyDonutSvg);
            barElement.appendChild(dailyDonutSvg);
        });

    // RECOVERED LINE
    let line = d3
        .line()
        .defined(d => !isNaN(d.value))
        .x(d => xScale(d.date))
        .y(d => yScale(d.value));

    svg.append("path")
        .datum(recovered)
        .attr("fill", "none")
        .attr("stroke", "chartreuse")
        .attr("stroke-width", 1.5)
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("d", line);

    // LEGEND
    let legend = d3
        .select(barElement)
        .append("svg")
        .attr("id", "legend")
        .attr("width", 400)
        .attr("height", 50);

    legend
        .selectAll("rect")
        .data(colorScheme.slice(0, series.length).concat("#7fff00"))
        .join("rect")
        .attr("x", (d, i) => i * 50)
        .attr("y", 0)
        .attr("width", 30)
        .attr("height", 30)
        .attr("fill", d => d);

    legend
        .selectAll("text")
        .data(keys.concat("recovered"))
        .join("text")
        .attr("x", (d, i) => i * 50)
        .attr("y", 45)
        .text(d => d)
        .attr("fill", "white")
        .style("text-transform", "capitalize");
}

async function createDailyDonutChart(dateString) {
    let width = 800;
    let radius = width / 6;
    let svg = d3
        .select(donutElement)
        .append("svg")
        .attr("id", "sunburst")
        .attr("fill", "white")
        .attr("width", width)
        .attr("height", width);

    // GET DATA
    let dateQuery = `${Number(dateString.slice(5, 7))}-${dateString.slice(
        8
    )}-${dateString.slice(0, 4)}`;

    // Check the local storage first.
    let raw;
    if (localStorage.getItem(dateString)) {
        raw = JSON.parse(localStorage.getItem(dateString));
    } else {
        raw = await fetchData(baseURL, `daily/${dateQuery}`);
        localStorage.setItem(dateString, JSON.stringify(raw));
        console.log("sukses", dateString);
    }

    if (raw.length === 0) {
        svg.append("text")
            .attr("dx", 50)
            .attr("dy", 50)
            .attr("font-size", 16)
            .text(`No data for this day yet ${dateString}.`);
        return svg.node();
    }
    let data = changeDataToDonutData(dateString, raw);

    // SUNBURST
    let arc = d3
        .arc()
        .startAngle(d => d.x0)
        .endAngle(d => d.x1)
        .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
        .padRadius(radius * 1.5)
        .innerRadius(d => d.y0 * radius)
        .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    let format = d3.format(",d");
    let color = d3.scaleOrdinal(
        d3.quantize(d3.interpolateRainbow, data.children.length + 1)
    );

    let partition = data => {
        const root = d3
            .hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);
        return d3.partition().size([2 * Math.PI, root.height + 1])(root);
    };

    let root = partition(data);

    root.each(d => (d.current = d));

    let g = svg
        .append("g")
        .attr("transform", `translate(${width / 2},${width / 2})`);

    let path = g
        .append("g")
        .selectAll("path")
        .data(root.descendants().slice(1))
        .join("path")
        .attr("fill", d => {
            while (d.depth > 1) d = d.parent;
            return color(d.data.name);
        })
        .attr("fill-opacity", d =>
            arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0
        )
        .attr("d", d => arc(d.current));

    path.filter(d => d.children)
        .style("cursor", "pointer")
        .on("click", clicked);

    path.append("title").text(
        d =>
            `${d
                .ancestors()
                .map(d => d.data.name)
                .reverse()
                .join("/")}`
    );

    let label = g
        .append("g")
        .attr("pointer-events", "none")
        .attr("text-anchor", "middle")
        .style("user-select", "none")
        .selectAll("text")
        .data(root.descendants().slice(1))
        .join("text")
        .attr("dy", "0.35em")
        .attr("fill-opacity", d => +labelVisible(d.current))
        .attr("transform", d => labelTransform(d.current))
        .text(d => d.data.name);

    let parent = g
        .append("circle")
        .datum(root)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("click", clicked);

    function clicked(p) {
        parent.datum(p.parent || root);

        root.each(
            d =>
                (d.target = {
                    x0:
                        Math.max(
                            0,
                            Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))
                        ) *
                        2 *
                        Math.PI,
                    x1:
                        Math.max(
                            0,
                            Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))
                        ) *
                        2 *
                        Math.PI,
                    y0: Math.max(0, d.y0 - p.depth),
                    y1: Math.max(0, d.y1 - p.depth),
                })
        );

        let t = g.transition().duration(750);

        // Transition the data on all arcs, even the ones that aren’t visible,
        // so that if this transition is interrupted, entering arcs will start
        // the next transition from the desired position.
        path.transition(t)
            .tween("data", d => {
                let i = d3.interpolate(d.current, d.target);
                return t => (d.current = i(t));
            })
            .filter(function(d) {
                return (
                    +this.getAttribute("fill-opacity") || arcVisible(d.target)
                );
            })
            .attr("fill-opacity", d =>
                arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0
            )
            .attrTween("d", d => () => arc(d.current));

        label
            .filter(function(d) {
                return (
                    +this.getAttribute("fill-opacity") || labelVisible(d.target)
                );
            })
            .transition(t)
            .attr("fill-opacity", d => +labelVisible(d.target))
            .attrTween("transform", d => () => labelTransform(d.current));
    }

    function arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d) {
        let x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
        let y = ((d.y0 + d.y1) / 2) * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${
            x < 180 ? 0 : 180
        })`;
    }

    return svg.node();
}

function changeDataToDonutData(dateString, data) {
    let obj = {
        name: dateString,
        children: [],
    };

    let country = Array.from(new Set(data.map(d => d.countryRegion)));
    country.forEach(c => obj.children.push({ name: c }));

    data.forEach(t => {
        obj.children.forEach((c, i) => {
            if (c.name === t.countryRegion) {
                if (!obj.children[i].children) {
                    obj.children[i].children = [];
                }
                obj.children[i].children.push({
                    name: t.provinceState || t.countryRegion,
                    children: [
                        {
                            name: `confirmed\n${t.confirmed}`,
                            value: Math.log1p(+t.confirmed),
                        },
                        {
                            name: `deaths\n${t.deaths}`,
                            value: Math.log1p(+t.deaths),
                        },
                        {
                            name: `recovered\n${t.recovered}`,
                            value: Math.log1p(+t.recovered),
                        },
                    ],
                });
            }
        });
    });
    return obj;
}

async function createCountryDonut(countryISO3) {
    // remove children first if any
    if (donutElement.childElementCount) {
        donutElement.removeChild(donutElement.firstChild);
    }

    // get the data
    let rawData;
    // if (localStorage.getItem(countryISO3)) {
        // rawData = JSON.parse(localStorage.getItem(countryISO3));
    // } else {
        rawData = await fetchData(baseURL, `countries/${countryISO3}`);
    //     localStorage.setItem(countryISO3, JSON.stringify(rawData));
    //     console.log("sukses", countryISO3);
    // }

    if (rawData.error) {
        let informError =
            "<p class='no-data'>No data for the selected country.</p>";
        donutElement.insertAdjacentHTML("beforeend", informError);
        return;
    }

    let data = Object.keys(rawData)
        .slice(0, -1)
        .map(d => {
            return {
                name: d,
                value: rawData[d].value,
            };
        });
    data.columns = ["name", "value"];
    // console.log(rawData);

    // DONUT
    createDonut(data, donutElement, rawData.lastUpdate);
}

async function createIndonesiaData() {
    // get the data
    let rawData = await fetch('https://jakarta.mathdro.id/api').then(d => d.json());
    let data = Object.keys(rawData.data.nasional)
        .slice(0, -2)
        .map(d => {
            return {
                name: d,
                value: rawData.data.nasional[d],
            };
        });
    data.columns = ["name", "value"];
    console.log(rawData);

    // DONUT
    createDonut(data, idnElement, new Date());
}

function createDonut(data, element, date) {
    let width = window.innerWidth;
    let height = Math.min(width, 500);
    let radius = Math.min(width, height) / 2;
    let donut = d3
        .pie()
        .padAngle(0.005)
        .sort(null)
        .value(d => d.value);

    let arc = d3
        .arc()
        .innerRadius(radius * 0.67)
        .outerRadius(radius - 1);

    let color = d3
        .scaleOrdinal()
        .domain(data.map(d => d.name))
        .range(
            d3
                .quantize(
                    t => d3.interpolateSpectral(t * 0.8 + 0.1),
                    data.length
                )
                .reverse()
        );

    let svg = d3
        .select(element)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2}, ${height / 2})`);

    svg.selectAll("path")
        .data(donut(data))
        .join("path")
        .attr("fill", d => color(d.data.name))
        .attr("d", arc)
        .transition()
        .ease(d3.easeLinear)
        .duration(2000)
        .attrTween("d", pieTween);

    // DONUT TEXT
    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 12)
        .attr("text-anchor", "middle")
        .selectAll("text")
        .data(donut(data))
        .join("text")
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .call(text =>
            text
                .append("tspan")
                .attr("y", (d, i) => `-0.4em`)
                .attr("font-weight", "bold")
                .text(d => d.data.name)
        )
        .call(text =>
            text
                // .filter(d => d.endAngle - d.startAngle > 0.25)
                .append("tspan")
                .attr("x", 0)
                .attr("y", "0.7em")
                .attr("fill-opacity", 0.7)
                .text(d => numberFormat(d.data.value))
        );

    svg.append("g")
        .append("text")
        .text(`Last update: ${new Date(date).toDateString() || new Date().toDateString()}`)
        .attr("dx", "-80")
        .attr("fill", "white")
        .attr("font-size", 14);

    function pieTween(b) {
        b.innerRadius = 0;
        let i = d3.interpolate({ startAngle: 0, endAngle: 0 }, b);
        return function(t) {
            return arc(i(t));
        };
    }
}


function numberFormat(n) {
    return new Intl.NumberFormat().format(n);
}

function init() {
    createDailyBarChart();
    createSelection();
    countriesElement.addEventListener("change", event =>
        createCountryDonut(event.currentTarget.value)
    );
    createIndonesiaData();
}

init();
