var BAR_CHART_WIDTH = 250;
var BAR_CHART_HEIGHT = 200;

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
		{ id: "bar1", field: "Age", bin: 3 },
		{ id: "bar2", field: "Daily_Screen_Time", bin: 1.1 },
		{ id: "bar3", field: "Sleep_Quality", bin: 1 },
		{ id: "bar4", field: "Stress_Level", bin: 1 },
		{ id: "bar5", field: "Days_Without_Social_Media", bin: 1 },
		{ id: "bar6", field: "Exercise_Frequency", bin: 1 },
		{ id: "bar7", field: "Happiness_Index", bin: 1 }
	];

	// init bar charts
	let barCharts = [];
	barConfig.forEach(cfg => {
		let chart = createBarChart("#" + cfg.id, data, cfg.field, cfg.bin);
		barCharts.push(chart);
	});

	// dropdown change listener
	d3.select("#groupSelector").on("change", function () {
		const groupBy = this.value;
		barCharts.forEach(chart => chart.update(groupBy));
	});

});

// bar charts
function createBarChart(container, data, field, bin) {
	const margin = createMargins(BAR_CHART_WIDTH, BAR_CHART_HEIGHT);

	// create svg
	const svg = d3.select(container)
		.append("svg")
		.attr("width", BAR_CHART_WIDTH)
		.attr("height", BAR_CHART_HEIGHT);

	const inner = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

	const plotWidth = BAR_CHART_WIDTH - margin.left - margin.right;
	const plotHeight = BAR_CHART_HEIGHT - margin.top - margin.bottom;

	// 改為線性尺度
	const xScale = d3.scaleLinear().range([0, plotWidth]);
	const yScale = d3.scaleLinear().range([plotHeight, 0]);

	const xAxisG = inner.append("g").attr("transform", `translate(0,${plotHeight})`);
	const yAxisG = inner.append("g");

	const colorScale = d3.scaleOrdinal(d3.schemeSet2);

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
			// simple bar chart without grouping
			const rolled = d3.rollups(
				data,
				v => v.length,
				d => Math.round(d[field] / bin) * bin  // 使用 bin 來分組
			).sort((a, b) => d3.ascending(+a[0], +b[0]));

			barData = rolled.map(([key, value]) => ({ 
				key, 
				values: [{ group: "All", value }] 
			}));
			groups = ["All"];
		} else {
			// stacked bar chart with grouping
			const grouped = d3.group(data, d => Math.round(d[field] / bin) * bin);
			
			barData = Array.from(grouped, ([key, values]) => {
				const groupCounts = d3.rollups(values, v => v.length, d => d[groupBy]);
				const valuesByGroup = groupCounts.map(([group, value]) => ({ group, value }));
				return { key, values: valuesByGroup };
			}).sort((a, b) => d3.ascending(+a.key, +b.key));

			groups = [...new Set(data.map(d => d[groupBy]))].sort();
		}

		// update scales - 使用線性尺度
		const keys = barData.map(d => +d.key);
		const minKey = d3.min(keys);
		const maxKey = d3.max(keys);
		
		// 設定 x 軸範圍，留一些邊距
		xScale.domain([minKey - bin/2, maxKey + bin/2]);

		// 計算條形寬度
		const barWidth = Math.min(
			plotWidth / barData.length * 0.8,  // 最大寬度限制
			(plotWidth / (maxKey - minKey + bin)) * bin * 0.8  // 根據實際數值範圍計算
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

		yScale.domain([0, d3.max(stacked, layer => d3.max(layer, d => d[1])) || 1]).nice();

		// axes
		xAxisG.call(d3.axisBottom(xScale).tickSizeOuter(0));
		yAxisG.call(d3.axisLeft(yScale).ticks(4));

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
			.attr("height", 0);

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

	return {
		update
	};
}