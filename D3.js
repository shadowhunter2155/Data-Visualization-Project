var BAR_CHART_WIDTH = 250;
var BAR_CHART_HEIGHT = 200;
var SCATTER_CHART_WIDTH = 700;
var SCATTER_CHART_HEIGHT = 490;
var BUBBLE_CHART_WIDTH = 700;
var BUBBLE_CHART_HEIGHT = 490;

function createMargins(width, height) {
	return {
		top: height * 0.12,
		right: width * 0.12,
		bottom: height * 0.12,
		left: width * 0.12
	};
}

let activeFilters = {
	Gender: [],
	Social_Media_Platform: [],
	Scatter: [],
	Bubble: []
};


// load data
d3.csv("dataset/Mental_Health_and_Social_Media_Balance_Dataset.csv").then(rawData => {
	const data = rawData.map((d, i) => ({
		id: i,
		Age: +d.Age,
		Daily_Screen_Time: +d.Daily_Screen_Time,
		Sleep_Quality: +d.Sleep_Quality,
		Stress_Level: +d.Stress_Level,
		Days_Without_Social_Media: +d.Days_Without_Social_Media,
		Exercise_Frequency: +d.Exercise_Frequency,
		Happiness_Index: +d.Happiness_Index,
		Gender: d.Gender,
		Social_Media_Platform: d.Social_Media_Platform
	}));

	const barConfig = [
		{ id: "bar1", field: "Age", bin_width: 5, isInterval: true },
		{ id: "bar2", field: "Daily_Screen_Time", bin_width: 1, isInterval: true },
		{ id: "bar3", field: "Sleep_Quality", bin_width: 1, isInterval: false },
		{ id: "bar4", field: "Stress_Level", bin_width: 1, isInterval: false },
		{ id: "bar5", field: "Days_Without_Social_Media", bin_width: 1, isInterval: false },
		{ id: "bar6", field: "Exercise_Frequency", bin_width: 1, isInterval: false },
		{ id: "bar7", field: "Happiness_Index", bin_width: 1, isInterval: false }
	];

	// init bar charts
	let barCharts = [];
	barConfig.forEach(cfg => {
		let chart = createBarChart("#" + cfg.id, data, cfg.field, cfg.bin_width, cfg.isInterval);
		barCharts.push(chart);
	});
	// dropdown change listener
	d3.select("#groupSelector").on("change", function () {
		const groupBy = this.value;
		barCharts.forEach(chart => chart.update(groupBy));
		updateFilterOptions(groupBy);
	});

	// init scatter chart
	let scatterChart = createScatter("#scatter", data);
	let bubbleChart = createBubbleGrid("#bubble", data);

	// dropdown change listener
	d3.select("#scatterColorSelector").on("change", function () {
		const field = this.value;
		scatterChart.update(field);
		bubbleChart.update(field);
	});

	// filter for bar charts
	function updateFilterOptions(groupBy) {
		const filterContainer = d3.select("#filterContainer");
		filterContainer.html("");
		if (groupBy === "") {
			filterContainer.style("display", "none");
			return; 
		}
		filterContainer.style("display", "flex");

		const uniqueValues = [...new Set(data.map(d => d[groupBy]))].sort();
		const filterOptions = filterContainer.selectAll(".filter-option")
			.data(uniqueValues)
			.enter()
			.append("div")
			.attr("class", `filter-option filter-label`);
		
		filterOptions.append("input")
			.attr("type", "checkbox")
			.attr("id", d => `filter-${groupBy}-${d}`)
			.attr("value", d => d)
			.attr("checked", true) // all for default
			.on("change", function(event, d) {
				handleFilterChange(groupBy, d, this.checked);
			});
		filterOptions.append("span").text(d => d);
		activeFilters[groupBy] = [...uniqueValues];
		barCharts.forEach(chart => chart.update(groupBy));
	}

	function handleFilterChange(groupBy, value, isChecked) {
		if (isChecked) {
			if (!activeFilters[groupBy].includes(value)) {
				activeFilters[groupBy].push(value);
			}
		} else {
			activeFilters[groupBy] = activeFilters[groupBy].filter(v => v !== value);
		}
		//update
		const currentGroupBy = d3.select("#groupSelector").node().value;
		if (currentGroupBy === groupBy) {
			barCharts.forEach(chart => chart.update(groupBy));
		}
	}
});

// bar charts
function createBarChart(container, data, field, bin, isInterval) {
	const margin = createMargins(BAR_CHART_WIDTH, BAR_CHART_HEIGHT);
	// create svg
	const svg = d3.select(container)
		.append("svg")
		.attr("width", BAR_CHART_WIDTH)
		.attr("height", BAR_CHART_HEIGHT);

	const inner = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	const plotWidth = BAR_CHART_WIDTH - margin.left - margin.right;
	const plotHeight = BAR_CHART_HEIGHT - margin.top - margin.bottom;
	const xScale = d3.scaleLinear().range([0, plotWidth]);
	const yScale = d3.scaleLinear().range([plotHeight, 0]);
	const xAxisG = inner.append("g").attr("transform", `translate(0,${plotHeight})`);
	const yAxisG = inner.append("g");
	const genderColors = { "Male": "#4A90E2", "Female": "#FF69B4", "Other": "#9E9E9E" };
	const socialAppColors = [
		"#1f77b4", "#ff7f0e", "#2ca02c",
		"#d62728", "#9467bd", "#8c564b" ];
	let colorScale = d3.scaleOrdinal().range(socialAppColors);

	// tooltips
	const tooltip = d3.select("body")
		.append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);

	// title
	svg.append("text")
		.attr("x", BAR_CHART_WIDTH / 2)
		.attr("y", 14)
		.attr("text-anchor", "middle")
		.style("font-size", "12px")
		.text(field.replace(/_/g, " "));

	// update
	function update(groupBy = "") {
		let filteredData = data;
		if (groupBy !== "" && activeFilters[groupBy].length > 0) {
            filteredData = data.filter(d => activeFilters[groupBy].includes(d[groupBy]));
        }
		let barData;
		let groups;

		if (groupBy === "") {
			// color
			colorScale = d3.scaleOrdinal().range(socialAppColors);
			// interval bins
			const rolled = d3.rollups(
				filteredData,
				v => v.length,
				d => isInterval ? Math.round(d[field] / bin) * bin : d[field]
			).sort((a, b) => d3.ascending(+a[0], +b[0]));

			barData = rolled.map(([key, value]) => ({ 
				key, 
				values: [{ group: "All", value }] 
			}));
			groups = ["All"];
		} else {
			// color
			if (groupBy === "Gender") {
				colorScale = d3.scaleOrdinal().domain(["Male", "Female", "Other"])
					.range([
						genderColors.Male,
						genderColors.Female,
						genderColors.Other
					]);
					groups = ["Male", "Female", "Other"];
			} else {
				colorScale = d3.scaleOrdinal().range(socialAppColors);
				groups = [...new Set(filteredData.map(d => d[groupBy]))].sort();
			}
			// stacked bar chart with grouping
			const grouped = d3.group(filteredData, d => isInterval ? Math.round(d[field] / bin) * bin : d[field]);
			
			barData = Array.from(grouped, ([key, values]) => {
				const groupCounts = d3.rollups(values, v => v.length, d => d[groupBy]);
				const valuesByGroup = groupCounts.map(([group, value]) => ({ group, value }));
				return { key, values: valuesByGroup };
			}).sort((a, b) => d3.ascending(+a.key, +b.key));
		}

		// scales
		const keys = barData.map(d => +d.key);
		const minKey = -0.1;
		const maxKey = d3.max(keys);

		xScale.domain([minKey - bin/2, maxKey + bin/2]);

		const barWidth = Math.min(
			plotWidth / barData.length * 0.95,
			(plotWidth / (maxKey - minKey + bin)) * bin * 0.95
		);

		// calculate stack data for y-scale domain
		const stackData = barData.map(d => {
			const obj = { key: d.key };
			d.values.forEach(v => {
				obj[v.group] = v.value;
			});
			return obj;
		});

		const stacked = d3.stack()
			.keys(groups)
			.value((d, key) => d[key] || 0)
			.order(d3.stackOrderNone)
			.offset(d3.stackOffsetNone)(stackData);

		yScale.domain([0, d3.max(stacked, layer => d3.max(layer, d => d[1]))*1.05]).nice();
		// axes
		xAxisG.call(d3.axisBottom(xScale).tickSizeOuter(0));
		yAxisG.call(d3.axisLeft(yScale).ticks(6).tickSizeOuter(0));

		// color scale domain
		colorScale.domain(groups);

		// draw
		const layer = inner.selectAll(".layer")
			.data(stacked, d => d.key);

		layer.enter()
			.append("g")
			.attr("class", "layer")
			.attr("fill", d => colorScale(d.key))
			.selectAll("rect")
			.data(d => d)
			.join("rect")
			.attr("x", d => xScale(+d.data.key) - barWidth/2)
			.attr("width", barWidth)
			.attr("y", plotHeight)
			.attr("height", 0)
			.on("mouseover", (event, d) => { //tooltips
				const groupName = d3.select(event.currentTarget.parentNode).datum().key;
				const count = d[1] - d[0];
				let valueText;
				
				if (isInterval) {
					const start = +d.data.key - bin / 2;
					const end = start + bin;
					valueText = `<b>Value:</b> ${start}-${end}`;
				} else {
					valueText = `<b>Value:</b> ${d.data.key}`;
				}
				
				let tooltipContent = `<b>Count:</b> ${count}<br>${valueText}`;

				if (groupBy !== "") {
					tooltipContent += `<br><b>Group:</b> ${groupName}`;
				}
				
				tooltip.style("opacity", 1)
					.html(tooltipContent)
					.style("left", (event.pageX + 15) + "px")
					.style("top", (event.pageY - 20) + "px");
			})
			.on("mouseout", () => {
				tooltip.style("opacity", 0);
			});

		inner.selectAll(".layer")
			.data(stacked, d => d.key)
			.attr("fill", d => colorScale(d.key))
			.selectAll("rect")
			.data(d => d)
			.transition()
			.duration(600)
			.attr("x", d => xScale(+d.data.key) - barWidth/2)
			.attr("width", barWidth)
			.attr("y", d => yScale(d[1]))
			.attr("height", d => yScale(d[0]) - yScale(d[1]));
			
		layer.exit().remove();
	}

	// init render
	update("");

	return { update };
}

// scatter plot (Daily Screen Time vs Sleep Quality)
function createScatter(container, data) {
	const margin = createMargins(SCATTER_CHART_WIDTH, SCATTER_CHART_HEIGHT);
	// create svg
	const svg = d3.select(container)
		.append("svg")
		.attr("width", SCATTER_CHART_WIDTH)
		.attr("height", SCATTER_CHART_HEIGHT);

	const inner = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	const plotWidth = SCATTER_CHART_WIDTH - margin.left - margin.right;
	const plotHeight = SCATTER_CHART_HEIGHT - margin.top - margin.bottom;
	const xScale = d3.scaleLinear()
		.domain([0, 11]).range([0, plotWidth]).nice();
	const yScale = d3.scaleLinear()
		.domain([1, 10]).range([plotHeight, 0]).nice();

	// default color scale (Stress)
	let colorScale = d3.scaleLinear().domain([1, 6, 10])
		.range(["#1a9850", "#ebc45b", "#d73027"]);

	// tooltips
	const tooltip = d3.select("body")
		.append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);

	// title and labels
	svg.append("text")
		.attr("x", SCATTER_CHART_WIDTH / 2)
		.attr("y", SCATTER_CHART_HEIGHT * 0.05)
		.attr("text-anchor", "middle")
		.style("font-size", "18px")
		.text("Daily Screen Time vs Sleep Quality");

	svg.append("text") 
		.attr("x", SCATTER_CHART_WIDTH / 2) 
		.attr("y", SCATTER_CHART_HEIGHT * 0.97) 
		.attr("text-anchor", "middle") 
		.style("font-size", "16px") 
		.text("Daily Screen Time (hours)"); 

	svg.append("text") 
		.attr("transform", "rotate(-90)") 
		.attr("x", -SCATTER_CHART_HEIGHT / 2) 
		.attr("y", SCATTER_CHART_HEIGHT * 0.1) 
		.attr("text-anchor", "middle") 
		.style("font-size", "16px") 
		.text("Sleep Quality");
	
	// draw axes
	inner.append("g")
		.attr("transform", `translate(0,${plotHeight})`)
		.call(d3.axisBottom(xScale)).style("font-size", "12px");

	inner.append("g").call(d3.axisLeft(yScale)).style("font-size", "12px");

	// grid lines
	inner.selectAll(".horizontal-grid")
		.data(yScale.ticks(10).filter(d => d > 1))
		.enter().append("line")
		.attr("class", "horizontal-grid")
		.attr("x1", 1)
		.attr("x2", plotWidth +2)
		.attr("y1", d => yScale(d))
		.attr("y2", d => yScale(d))
		.attr("stroke", "#eee")
		.attr("stroke-width", 1);
		
	inner.selectAll(".vertical-grid")
		.data(xScale.ticks(10).filter(d => d > 0))
		.enter().append("line")
		.attr("class", "vertical-grid")
		.attr("x1", d => xScale(d))
		.attr("x2", d => xScale(d))
		.attr("y1", -5)
		.attr("y2", plotHeight - 2)
		.attr("stroke", "#eee")
		.attr("stroke-width", 2);

	// dots
	let dots = inner.selectAll("circle")
		.data(data)
		.join("circle")
		.attr("r", 5)
		.attr("cx", d => xScale(d.Daily_Screen_Time))
		.attr("cy", d => yScale(d.Sleep_Quality))
		.attr("opacity", 0.85)
		.attr("fill", d => colorScale(d.Stress_Level))
		.attr("stroke", "white")
		.attr("stroke-width", 0.1)
		.on("mouseover", (event, d) => {
			d3.select(event.currentTarget).raise()
				.transition()
				.duration(200)
				.attr("r", 6)
				.attr("opacity", 1)
				.attr("stroke-width", 1);
			// tooltip
			tooltip.style("opacity", 1).html(
				`<b>Daily Screen Time:</b> ${d.Daily_Screen_Time}<br>
					<b>Sleep Quality:</b> ${d.Sleep_Quality}<br>
					<b>Stress Level:</b> ${d.Stress_Level}<br>
					<b>Happiness:</b> ${d.Happiness_Index}`
			).style("left", event.pageX + 15 + "px")
			 .style("top", event.pageY - 20 + "px");
		})
		.on("mouseout", (event) => {
			d3.select(event.currentTarget)
				.transition()
				.duration(200)
				.attr("r", 5)
				.attr("opacity", 0.85)
				.attr("stroke-width", 0.1);
			tooltip.style("opacity", 0);
		});

	// color bar legend
	const legend = svg.append("g")
		.attr("class", "legend")
		.attr("transform", `translate(${SCATTER_CHART_WIDTH * 0.70}, ${SCATTER_CHART_HEIGHT * 0.15})`);

	function updateLegend(field) {
		legend.selectAll("*").remove();

		// legend title
		legend.append("text")
			.attr("x", 50)
			.attr("y", -8)
			.style("font-size", "12px")
			.text(field.replace(/_/g, " "))
			.style("opacity", 0)
			.transition()
			.duration(300)
			.style("opacity", 1);

		// box
		const boxSize = 15;
		const boxPadding = 1;
		const levels = d3.range(1, 11); // 1–10
		const boxGroup = legend.append("g")
			.attr("transform", "translate(0, 0)")
			.style("opacity", 0);

		boxGroup.selectAll("rect")
			.data(levels)
			.join("rect")
			.attr("x", (d, i) => i * (boxSize + boxPadding))
			.attr("y", 0)
			.attr("width", boxSize)
			.attr("height", 12)
			.attr("fill", d => colorScale(d))
			.style("opacity", 0)
			.transition()
			.duration(150)
			.delay((d, i) => i * 30)
			.style("opacity", 1);

		// tick labels
		const labelGroup = legend.append("g")
			.attr("transform", "translate(0, 20)")
			.style("opacity", 0);

		labelGroup.selectAll("text")
			.data(levels)
			.join("text")
			.attr("x", (d, i) => i * (boxSize + boxPadding) + boxSize / 2)
			.attr("y", 0)
			.attr("text-anchor", "middle")
			.style("font-size", "10px")
			.text(d => d)
			.style("opacity", 0)
			.transition()
			.duration(150)
			.delay((d, i) => i * 30 + 100)
			.style("opacity", 1);

		boxGroup.transition()
			.duration(200)
			.style("opacity", 1);

		labelGroup.transition()
			.duration(200)
			.delay(50)
			.style("opacity", 1);
	}

	// update
	function update(field) { // update colorScale
		if (field === "Happiness_Index") {
			colorScale = d3.scaleLinear()
				.domain([1, 6, 10])
				.range(["#d73027", "#ebc45b", "#1a9850"]);
		} else if (field === "Stress_Level") {
			colorScale = d3.scaleLinear()
				.domain([1, 6, 10])
				.range(["#1a9850", "#ebc45b", "#d73027"]);
		}

		// update dot
		dots.transition()
			.duration(500)
			.attr("fill", d => colorScale(d[field]));

		updateLegend(field);
	}

	// initial legend (Stress)
	update("Stress_Level");
	updateLegend("Stress_Level");

	return { update };
}

// bubble grid chart
function createBubbleGrid(container, data) {
	const margin = createMargins(BUBBLE_CHART_WIDTH, BUBBLE_CHART_HEIGHT);
	
	// create svg
	const svg = d3.select(container)
		.append("svg")
		.attr("width", BUBBLE_CHART_WIDTH)
		.attr("height", BUBBLE_CHART_HEIGHT);

	const inner = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
	const plotWidth = BUBBLE_CHART_WIDTH - margin.left - margin.right;
	const plotHeight = BUBBLE_CHART_HEIGHT - margin.top - margin.bottom;
	
	const xValues = [0, 1, 2, 3, 4, 5, 6, 7]; // Exercise Frequency: 0-7 days
	const yValues = d3.range(0, 10, 1); // Days Without Social Media: 0-9 days
	
	const xScale = d3.scaleBand()
		.domain(xValues).range([0, plotWidth]).padding(0.1);
	const yScale = d3.scaleBand()
		.domain(yValues).range([plotHeight, 0]).padding(0.1);
	const sizeScale = d3.scaleSqrt().domain([0, 20]).range([5, 30]);
	
	// default color scale (Stress)
	let colorScale = d3.scaleLinear().domain([1, 6, 10])
		.range(["#1a9850", "#ebc45b", "#d73027"]);
	
	// tooltips
	const tooltip = d3.select("body")
		.append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);
	
	// title and labels
	svg.append("text")
		.attr("x", BUBBLE_CHART_WIDTH / 2)
		.attr("y", BUBBLE_CHART_HEIGHT * 0.05)
		.attr("text-anchor", "middle")
		.style("font-size", "18px")
		.text("Exercise Frequency vs Days Without Social Media");
	
	svg.append("text")
		.attr("x", BUBBLE_CHART_WIDTH / 2)
		.attr("y", BUBBLE_CHART_HEIGHT * 0.97)
		.attr("text-anchor", "middle")
		.style("font-size", "16px")
		.text("Exercise Frequency (days/week)");
	
	svg.append("text")
		.attr("transform", "rotate(-90)")
		.attr("x", -BUBBLE_CHART_HEIGHT / 2)
		.attr("y", BUBBLE_CHART_HEIGHT * 0.1)
		.attr("text-anchor", "middle")
		.style("font-size", "16px")
		.text("Days Without Social Media");
	
	// draw axes
	inner.append("g")
		.attr("transform", `translate(0,${plotHeight})`)
		.call(d3.axisBottom(xScale).tickSizeOuter(0))
		.style("font-size", "12px");
	
	inner.append("g")
		.call(d3.axisLeft(yScale).tickSizeOuter(0))
		.style("font-size", "12px");
	
	// grid lines
	inner.selectAll(".horizontal-grid")
		.data(yValues.slice(0))
		.enter().append("line")
		.attr("class", "horizontal-grid")
		.attr("x1", 2)
		.attr("x2", plotWidth)
		.attr("y1", d => yScale(d))
		.attr("y2", d => yScale(d))
		.attr("stroke", "#eee")
		.attr("stroke-width", 1);

	inner.selectAll(".vertical-grid")
		.data(xValues.slice(1))
		.enter().append("line")
		.attr("class", "vertical-grid")
		.attr("x1", d => xScale(d))
		.attr("x2", d => xScale(d))
		.attr("y1", 0)
		.attr("y2", plotHeight - 2)
		.attr("stroke", "#eee")
		.attr("stroke-width", 1);
	
	// dots
	function aggregateData(data, colorField) {
		const grouped = d3.group(data, 
			d => d.Exercise_Frequency, 
			d => d.Days_Without_Social_Media
		);
		
		const aggregatedData = [];
		
		for (const [xVal, yGroups] of grouped) {
			for (const [yVal, points] of yGroups) {
				const count = points.length;
				const avgValue = d3.mean(points, d => d[colorField]);
				
				aggregatedData.push({
					x: +xVal,
					y: +yVal,
					count: count,
					avgValue: avgValue || 0,
					points: points
				});
			}
		}
		
		// update sizeScale domain
		const maxCount = d3.max(aggregatedData, d => d.count);
		sizeScale.domain([0, maxCount]);
		
		return aggregatedData;
	}
	
	// merged data（Stress）
	let currentColorField = "Stress_Level";
	let aggregatedData = aggregateData(data, currentColorField);
	
	// bubbbles
	let bubbles = inner.selectAll(".bubble")
		.data(aggregatedData)
		.join("circle")
		.attr("class", "bubble")
		.attr("cx", d => xScale(d.x) + xScale.bandwidth() / 2)
		.attr("cy", d => yScale(d.y) + yScale.bandwidth() / 2)
		.attr("r", d => sizeScale(d.count))
		.attr("fill", d => colorScale(d.avgValue))
		.attr("opacity", 0.8)
		.attr("stroke", "white")
		.attr("stroke-width", 1.5)
		.style("cursor", "pointer")
		.on("mouseover", (event, d) => {
			d3.select(event.currentTarget).raise()
				.transition()
				.duration(200)
				.attr("opacity", 1)
				.attr("stroke-width", 2.5);
			//tooltip
			tooltip.style("opacity", 1).html(
				`<b>Exercise Frequency:</b> ${d.x}<br>
				 <b>Days Without Social Media:</b> ${d.y}<br>
				 <b>Number of People:</b> ${d.count}<br>
				 <b>Avg ${currentColorField.replace(/_/g, " ")}:</b> ${d.avgValue.toFixed(2)}`
			).style("left", (event.pageX + 15) + "px")
			 .style("top", (event.pageY - 20) + "px");
		})
		.on("mouseout", (event) => {
			d3.select(event.currentTarget)
				.transition()
				.duration(200)
				.attr("opacity", 0.8)
				.attr("stroke-width", 1.5);
			tooltip.style("opacity", 0);
		})
		.on("click", (event, d) => {
			// TODO: show the box plot of stress/happiness distribution
			console.log("Selected grid cell:", d);
		});
		
	// color bar legend
	const legend = svg.append("g")
		.attr("class", "legend")
		.attr("transform", `translate(${SCATTER_CHART_WIDTH * 0.70}, ${SCATTER_CHART_HEIGHT * 0.15})`);

	function updateLegend(field) {
		legend.selectAll("*").remove();

		// legend title
		legend.append("text")
			.attr("x", 50)
			.attr("y", -8)
			.style("font-size", "12px")
			.text(field.replace(/_/g, " "))
			.style("opacity", 0)
			.transition()
			.duration(300)
			.style("opacity", 1);

		const width = 160;
		const height = 12;
		// create gradient id
		const gradientId = "legend-gradient-" + field;

		let defs = svg.select("defs");
		if (defs.empty()) defs = svg.append("defs");
		defs.select("#" + gradientId).remove();

		const gradient = defs.append("linearGradient")
			.attr("id", gradientId)
			.attr("x1", "0%")
			.attr("y1", "0%")
			.attr("x2", "100%")
			.attr("y2", "0%");

		let domain = colorScale.domain();
		let min = domain[0], mid = domain[1], max = domain[2];

		gradient.append("stop")
			.attr("offset", "0%")
			.attr("stop-color", colorScale(min));

		gradient.append("stop")
			.attr("offset", "60%")
			.attr("stop-color", colorScale(mid));

		gradient.append("stop")
			.attr("offset", "100%")
			.attr("stop-color", colorScale(max));

		// draw gradient bar
		legend.append("rect")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", width)
			.attr("height", height)
			.style("fill", `url(#${gradientId})`)
			.style("opacity", 0)
			.transition()
			.duration(300)
			.style("opacity", 1);

		// tick labels (1 and 10)
		const labelGroup = legend.append("g")
			.attr("transform", "translate(0, 20)")
			.style("opacity", 0);

		labelGroup.append("text")
			.attr("x", 0)
			.attr("y", 0)
			.text(min)
			.style("font-size", "10px");

		labelGroup.append("text")
			.attr("x", width)
			.attr("y", 0)
			.attr("text-anchor", "end")
			.text(max)
			.style("font-size", "10px");

		labelGroup.transition()
			.duration(250)
			.delay(50)
			.style("opacity", 1);
	}

	// update
	function update(field) { // update colorScale
		currentColorField = field;
		if (field === "Happiness_Index") {
			colorScale = d3.scaleLinear()
				.domain([1, 6, 10])
				.range(["#d73027", "#ebc45b", "#1a9850"]);
		} else if (field === "Stress_Level") {
			colorScale = d3.scaleLinear()
				.domain([1, 6, 10])
				.range(["#1a9850", "#ebc45b", "#d73027"]);
		}
		aggregatedData = aggregateData(data, field);
		
		// update bubble
		bubbles.data(aggregatedData)
			.transition()
			.duration(500)
			.attr("r", d => sizeScale(d.count))
			.attr("fill", d => colorScale(d.avgValue));

		updateLegend(field);
	}

	// initial legend (Stress)
	update("Stress_Level");
	updateLegend("Stress_Level");
	
	return { update };
}