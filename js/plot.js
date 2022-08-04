const country1Default = "US";
const country2Default = "Italy";
const maxDateDefault = new Date();

const dataUrl = "https://coronavirus-tracker-api.herokuapp.com/all";

function daysCalculation(date) {
    var date1 = new Date("01/22/2020");
    var differentTimes = date - date1;
    return Math.floor(differentTimes / (1000*3600*24));
}

function fetchData(url) {
    return fetch(url).then((response) => {
        if (response.status != 200) {
        throw new Error(`Unexpected response status: ${response.status}`);
        } else {
        // console.log(response);
        return response.json();
        }
    });
}


function downloadLocationData() {
    return fetchData(dataUrl).catch((error) => {
        console.log("API locations data can not be fetched! Use backup.json instead!");
        return d3.json("covid_19_0804.json").catch((error) =>{
        console.log("There is no dataset available!");
        });
    });
}




function setupSelections(chartConfig, rawData) {
    const confirmedRadio = document.getElementById("confirmed");
    const deathsRadio = document.getElementById("deaths");
    const country1Select = document.getElementById("country1");
    const country2Select = document.getElementById("country2");
    const dateSlider = document.getElementById("endDate");
    dateSlider.min = 0;
    dateSlider.step = 1;
    // console.log(rawData);
    // console.log(daysCalculation(new Date(rawData.confirmed.last_updated)));
    dateSlider.max = daysCalculation(new Date(rawData.confirmed.last_updated));
    dateSlider.value = daysCalculation(new Date(rawData.confirmed.last_updated));


    // Note: We're using rawData.confirmed to construct select lists even though the user can specify deaths.
    


    const addChangeListener = (element) => {
        element.addEventListener("change", (event) => {
        updateChart(chartConfig, country1Select, country2Select, dateSlider, rawData);
        });
    };

    addChangeListener(confirmedRadio);
    addChangeListener(deathsRadio);
    addChangeListener(dateSlider);

    const countries = rawData.confirmed.locations
          .filter((l) => !l.province)
          .map((l) => l.country)
          .sort((a, b) => a.localeCompare(b));
    // console.log(countries);

    for (let countryName of countries) {
        const el = document.createElement("option");
        el.textContent = countryName;
        el.value = countryName;
        const el2 = el.cloneNode(true);

        if (el.value == country1Default) {
        el.setAttribute("selected", "selected");
        }

        if (el2.value == country2Default) {
        el2.setAttribute("selected", "selected");
        }

        country1Select.appendChild(el);
        country2Select.appendChild(el2);
    }

    addChangeListener(country1Select);
    addChangeListener(country2Select);

    return { country1Select, country2Select, dateSlider};
}

function setupChart() {
    // Set the dimensions and margins of the graph
    const margin = { top: 30, right: 200, bottom: 30, left: 70 },
        width = 960 - margin.left - margin.right,
        height = 500 - margin.top - margin.bottom;
    const containerWidth = width + margin.left + margin.right,
        containerHeight = height + margin.top + margin.bottom;

    // Setup ranges
    const x = d3.scaleTime().range([0, width]);
    const y = d3.scaleLinear().range([height, 0]);

    // Append the svg object to the body of the page
    var svg = d3
        .select(".chart")
        .classed("svg-container", true)
        .append("svg")
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    return { svg, x, y, width, height };
}

function gatherChartData(type, country1, country2, maxDate, rawData) {

    let maxCount = null;
    const sourceData = rawData[type];
    // console.log(sourceData);

    const countries = [country1, country2].map((country) => {
          const cData = sourceData.locations.find((d) => d.country === country && !d.province).history;
          const data = Object.keys(cData)
            .map((k) => {
              const date = d3.timeParse("%m/%d/%y")(k);
              const count = +cData[k];

              if (date < maxDate) {
                if (!maxCount || maxCount < count) {
                  maxCount = count;
                }
              }

              return { date, count };
            })
            .filter((d) => d.date < maxDate)
            .sort((a, b) => a.date - b.date);

          return { country, data };
    });

    const chartData = { maxDate, maxCount, countries };

    // console.log(chartData);

    return chartData;
}

function renderData(chartConfig, chartData) {
// Remove any previous lines
d3.selectAll("g > *").remove();
// console.log(chartData);

// Scale the range of the data
chartConfig.x.domain(
    d3.extent(chartData.countries[0].data, function (d) {
    return d.date;
    })
);
chartConfig.y.domain([0, chartData.maxCount]);


// Define the scale parameter for each axis
const xScale = d3.scaleLinear()
               .domain([chartData.countries[0].data[0].date, chartData.countries[0].data[chartData.countries[0].data.length - 1].date])
               .range([0, chartConfig.width]);

const yScale = d3.scaleLinear()
               .range([chartConfig.height, 0])
               .domain([0, chartData.maxCount]);

// const formatValue = d3.format(",");
// const dateFormatter = d3.time.format("%m/%d/%y");


// Add line for each country
for (let i = 0; i < chartData.countries.length; i++) {
    const timelineData = chartData.countries[i].data;

    // Build the line
    const line = d3
    .line()
    .x(function (d) {
        return chartConfig.x(d.date);
    })
    .y(function (d) {
        return chartConfig.y(d.count);
    });

    // console.log(countryData);

    // Add the line to the chart
    chartConfig.svg
    .append("path")
    .datum(timelineData)
    .attr("class", `line country${(i + 1).toString()}`)
    .attr("d", line);

    // Add legend
    chartConfig.svg
    .append("text")
    .attr("transform", "translate(" + (chartConfig.width + 3) + "," + chartConfig.y(timelineData[timelineData.length - 1].count) + ")")
    .attr("dy", ".35em")
    .attr("text-anchor", "start")
    .attr("class", `legend country${(i + 1).toString()}`)
    .text(`${chartData.countries[i].country} (${chartData.countries[i].data[chartData.countries[i].data.length - 1].count.toLocaleString()})`);

    /* add tooltip
    const focus = chartConfig.svg
                    .append('g')
                    .attr('class', 'focus')
                    .style('display', 'none');
    focus.append('circle').attr('r', 5).attr('class', 'circle');
    focus.append("rect")
            .attr("class", "tooltip")
            .attr("width", 120)
            .attr("height", 50)
            .style("opacity", 0.1)
            .attr("x", 10)
            .attr("y", -22)
            .attr("rx", 4)
            .attr("ry", 4);

    focus.append("text")
            .attr("x", 18)
            .attr("y", -2)
            .text("count:");
    
    focus.append("text")
            .attr("class", "tooltip-count")
            .attr("x", 60)
            .attr("y", -2);

    focus.append("text")
            .attr("class", "tooltip-date")
            .attr("x", 18)
            .attr("y", 18);
    
    chartConfig.svg.append("rect")
            .attr("class", "overlay")
            .attr("width", chartConfig.width)
            .attr("height", chartConfig.height)
            .style('opacity', 0)
            .on("mouseover", function() { focus.style("display", null); })
            .on("mouseout", function() { focus.style("display", "none"); })
            .on("mousemove", function() {
                const xPos = d3.mouse(this)[0];
                const selectDate = xScale.invert(xPos);
                const bisect = d3.bisector(d => d.date).left;
                const i = bisect(countryData, selectDate);
                const d0 = countryData[i-1];
                const d1 = countryData[i];
                const d = selectDate - d0.date > d1.date - selectDate ? d1 : d0;
                focus.attr("transform", "translate(" + xScale(d.date) + "," + yScale(d.count) + ")");
                focus.select(".tooltip-count").text(d.count);
                focus.select(".tooltip-date").text(d.date.toDateString());
            });
            */
}

// Add the x axis
chartConfig.svg
    .append("g")
    .attr("transform", "translate(0," + chartConfig.height + ")")
    .call(d3.axisBottom(chartConfig.x));

// Add the y axis
chartConfig.svg.append("g").call(d3.axisLeft(chartConfig.y));

// add start date
addStartDate(chartConfig);

// Add multi line tooltip
var mouseG = chartConfig.svg.append("g")
        .attr("class", "mouse-over-effects");

// this is the vertical line
mouseG.append("path")
  .attr("class", "mouse-line")
  .style("stroke", "black")
  .style("stroke-width", "1px")
  .style("opacity", "0");
// keep a reference to all our lines
var lines = document.getElementsByClassName('line');
// console.log(lines[0].__data__);
// console.log(chartData.countries);

// here's a g for each circle and text on the line
var mousePerLine = mouseG.selectAll('.mouse-per-line')
  .data(chartData.countries)
  .enter()
  .append("g")
  .attr("class", "mouse-per-line");

// the circle
mousePerLine.append("circle")
  .attr("r", 7)
  .style("fill", "none")
  .style("stroke-width", "1px")
  .style("opacity", "0");

// the text
mousePerLine.append("text")
        .attr("x", 18)
        .attr("y", 10)
        .text("count:");

mousePerLine.append("text")
            .attr("class", "tooltip-count")
            .attr("x", 60)
            .attr("y", 10);

mousePerLine.append("text")
            .attr("class", "tooltip-date")
            .attr("x", 18)
            .attr("y", -10);
        

// rect to capture mouse movements
mouseG.append('svg:rect')
  .attr('width', chartConfig.width)
  .attr('height', chartConfig.height)
  .attr('fill', 'none')
  .attr('pointer-events', 'all')
  .on('mouseout', function() { // on mouse out hide line, circles and text
    d3.select(".mouse-line")
      .style("opacity", "0");
    d3.selectAll(".mouse-per-line circle")
      .style("opacity", "0");
    d3.selectAll(".mouse-per-line text")
      .style("opacity", "0");
  })
  .on('mouseover', function() { // on mouse in show line, circles and text
    d3.select(".mouse-line")
      .style("opacity", "1");
    d3.selectAll(".mouse-per-line circle")
      .style("opacity", "1");
    d3.selectAll(".mouse-per-line text")
      .style("opacity", "1");
  })
  .on('mousemove', function() { // mouse moving over canvas
    var mouse = d3.mouse(this);

    // move the vertical line
    d3.select(".mouse-line")
      .attr("d", function() {
        var d = "M" + mouse[0] + "," + chartConfig.height;
        d += " " + mouse[0] + "," + 0;
        return d;
      });

    // position the circle and text
    d3.selectAll(".mouse-per-line")
      .attr("transform", function(d, i) {
        // console.log(d);
        var xDate = xScale.invert(mouse[0]),
            bisect = d3.bisector(d => d.date).left;
            idx = bisect(d.data, xDate);
            point = d.data[idx];
        // console.log(xDate);
        // console.log(idx);
        // update the text with y value
        if (i === 0) {
            d3.select(this).select('circle')
              .style("stroke", d3.color("steelblue"));
            d3.select(this).select(".tooltip-count").text(point.count);
            d3.select(this).select(".tooltip-date").text("Date: " + point.date.toDateString());
            
        } else {
            d3.select(this).select('circle')
                 .style("stroke", d3.color("blueviolet"));
            d3.select(this).select(".tooltip-count").text(point.count);
        }

        transform = "translate(" + xScale(point.date) + "," + yScale(point.count) +")"; 

        return transform; 
      });

  });


}

function addStartDate(chartConfig) {
chartConfig.svg
    .append("text")
    .attr("transform", "translate(20," + (chartConfig.height - 60) + ")")
    .attr("dy", ".35em")
    .text(`start date is Jan. 22, 2020`);

chartConfig.svg.append("svg:defs").append("svg:marker")
    .attr("id", "triangle")
    .attr("refX", 6)
    .attr("refY", 6)
    .attr("markerWidth", 10)
    .attr("markerHeight", 10)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 12 6 0 12 3 6")
    .style("fill", "black");

chartConfig.svg.append("line")
  .attr("x1", 40)
  .attr("y1", chartConfig.height - 50)
  .attr("x2", 5)
  .attr("y2", chartConfig.height - 5)          
  .attr("stroke-width", 1)
  .attr("stroke", "black")
  .attr("marker-end", "url(#triangle)");
}



function updateChart(chartConfig, country1Select, country2Select, dateSlider, rawData) {
    const type = document.querySelector('input[name="type"]:checked').value;
    const country1 = country1Select.options[country1Select.selectedIndex].value;
    const country2 = country2Select.options[country2Select.selectedIndex].value;
    const minDate = new Date("01/22/2020");
    const maxDate = addDays(minDate, parseInt(dateSlider.value));
    // console.log(typeof dateSlider.value);
    // console.log(minDate);
    // console.log(maxDate);
    // console.log(maxDate > minDate);

    // console.log(type);
    var endDate = document.getElementById("date");

    endDate.innerHTML = maxDate.toDateString();

    const chartData = gatherChartData(type, country1, country2, maxDate, rawData);

    renderData(chartConfig, chartData);
}

function addDays(date, days) {
    var result = new Date(date);
    result.setDate(date.getDate() + days);
    return new Date(result);
}

document.addEventListener("DOMContentLoaded", (event) => {
    downloadLocationData().then((rawData) => {
      const chartConfig = setupChart();
      // console.log(rawData.confirmed);
      const { country1Select, country2Select, dateSlider} = setupSelections(chartConfig, rawData);

      // Initially render the chart
      updateChart(chartConfig, country1Select, country2Select, dateSlider, rawData);

      document.body.classList.add("loaded");

    });
});