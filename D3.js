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
	});

	// init scatter chart
	let scatterChart = createScatter("#scatter", data);
	// dropdown change listener
	d3.select("#scatterColorSelector").on("change", function () {
		const field = this.value;
		scatterChart.update(field);
	});
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
	const genderColors = { Male: "#4A90E2", Female: "#FF69B4", Other: "#9E9E9E" };
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
		let barData;
		let groups;

		if (groupBy === "") {
			// color
			colorScale = d3.scaleOrdinal().range(socialAppColors);
			// interval bins
			const rolled = d3.rollups(
				data,
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
			} else {
				colorScale = d3.scaleOrdinal().range(socialAppColors);
			}
			// stacked bar chart with grouping
			const grouped = d3.group(data, d => isInterval ? Math.round(d[field] / bin) * bin : d[field]);
			
			barData = Array.from(grouped, ([key, values]) => {
				const groupCounts = d3.rollups(values, v => v.length, d => d[groupBy]);
				const valuesByGroup = groupCounts.map(([group, value]) => ({ group, value }));
				return { key, values: valuesByGroup };
			}).sort((a, b) => d3.ascending(+a.key, +b.key));

			groups = [...new Set(data.map(d => d[groupBy]))].sort();
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
			.on("mouseover", (event, d) => {
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
			tooltip.style("opacity", 1).html(
				`<b>Daily Screen Time:</b> ${d.Daily_Screen_Time}<br>
					<b>Sleep Quality:</b> ${d.Sleep_Quality}<br>
					<b>Stress Level:</b> ${d.Stress_Level}<br>
					<b>Happiness:</b> ${d.Happiness_Index}`
			).style("left", event.pageX + 15 + "px")
			 .style("top", event.pageY - 20 + "px");
		})
		.on("mouseout", () => {
			tooltip.style("opacity", 0);
		});

	// color legend
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
			.text(field.replace(/_/g, " "));
		const boxSize = 15;
		const boxPadding = 1;
		const levels = d3.range(1, 11); // 1~10
		// group for color boxes
		const boxGroup = legend.append("g")
			.attr("transform", "translate(0, 0)");
		// boxes
		boxGroup.selectAll("rect")
			.data(levels)
			.join("rect")
			.attr("x", (d, i) => i * (boxSize + boxPadding))
			.attr("y", 0)
			.attr("width", boxSize)
			.attr("height", 12)
			.attr("fill", d => colorScale(d));
		// tick labels
		const labelGroup = legend.append("g")
			.attr("transform", "translate(0, 20)");
		labelGroup.selectAll("text")
			.data(levels)
			.join("text")
			.attr("x", (d, i) => i * (boxSize + boxPadding) + boxSize / 2)
			.attr("y", 0)
			.attr("text-anchor", "middle")
			.style("font-size", "10px")
			.text(d => d);
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

		dots.transition()
			.duration(500)
			.attr("fill", d => colorScale(d[field]));

		updateLegend(field);
	} // TODO: add transition for text and color

	// initial legend (Stress)
	update("Stress_Level");
	updateLegend("Stress_Level");

	return { update, dots };
}

// TODO: bubble chart