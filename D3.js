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
	// init scatter
	createScatter("#scatter", data);

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

//-----------------------------------------------------
//  SCATTER PLOT (Daily Screen Time vs Sleep Quality)
//-----------------------------------------------------
function createScatter(container, data) {

	const width = 700;
	const height = 490;

	const margin = {
		top: 30,
		right: 30,
		bottom: 50,
		left: 60
	};

	const plotWidth = width - margin.left - margin.right;
	const plotHeight = height - margin.top - margin.bottom;

	const svg = d3.select(container)
		.append("svg")
		.attr("width", width)
		.attr("height", height);

	
	const inner = svg.append("g")
		.attr("transform", `translate(${margin.left},${margin.top})`);

	//---------------------------------------------------
	// Scales
	//---------------------------------------------------
	const xScale = d3.scaleLinear()
		.domain(d3.extent(data, d => d.Daily_Screen_Time))
		.nice()
		.range([0, plotWidth]);

	const yScale = d3.scaleLinear()
		.domain(d3.extent(data, d => d.Sleep_Quality))
		.nice()
		.range([plotHeight, 0]);

	// 顏色漸層 1~10
	const colorScale = d3.scaleLinear()
		.domain([1, 10])
		.range(["#4ea8de", "#ff6b6b"]); // 藍 → 紅

	//---------------------------------------------------
	// Axes
	//---------------------------------------------------
	inner.append("g")
		.attr("transform", `translate(0,${plotHeight})`)
		.call(d3.axisBottom(xScale));

	inner.append("g").call(d3.axisLeft(yScale));

	svg.append("text")
		.attr("x", width / 2)
		.attr("y", 20)
		.attr("text-anchor", "middle")
		.style("font-size", "16px")
		.text("Daily Screen Time vs Sleep Quality");

	// labels
	svg.append("text")
		.attr("x", width / 2)
		.attr("y", height - 10)
		.attr("text-anchor", "middle")
		.style("font-size", "12px")
		.text("Daily Screen Time (hours)");

	svg.append("text")
		.attr("transform", "rotate(-90)")
		.attr("x", -height / 2)
		.attr("y", 15)
		.attr("text-anchor", "middle")
		.style("font-size", "12px")
		.text("Sleep Quality");

	//---------------------------------------------------
	// Tooltip
	//---------------------------------------------------
	const tooltip = d3.select("body")
		.append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);

	//---------------------------------------------------
	// 创建图例容器
	//---------------------------------------------------
	const legend = svg.append("g")
		.attr("class", "legend")
		.attr("transform", `translate(${width - 150}, ${margin.top + 20})`);

	// 图例标题函数
	function updateLegendTitle(field) {
		const title = field === "Stress_Level" ? "Stress Level" : "Happiness Index";
		legend.select(".legend-title").remove();
		legend.append("text")
			.attr("class", "legend-title")
			.attr("x", 0)
			.attr("y", -5)
			.style("font-size", "12px")
			.style("font-weight", "bold")
			.text(title);
	}

	// 创建渐变色条
	function createGradientLegend(field) {
		// 移除旧的图例内容
		legend.selectAll(".legend-item").remove();
		legend.select(".legend-gradient").remove();

		// 创建渐变色定义
		const defs = svg.append("defs");
		const gradient = defs.append("linearGradient")
			.attr("id", "color-gradient")
			.attr("x1", "0%")
			.attr("x2", "100%")
			.attr("y1", "0%")
			.attr("y2", "0%");

		gradient.append("stop")
			.attr("offset", "0%")
			.attr("stop-color", "#4ea8de");

		gradient.append("stop")
			.attr("offset", "100%")
			.attr("stop-color", "#ff6b6b");

		// 创建渐变色条
		legend.append("rect")
			.attr("class", "legend-gradient")
			.attr("x", 0)
			.attr("y", 0)
			.attr("width", 120)
			.attr("height", 10)
			.style("fill", "url(#color-gradient)");

		// 添加刻度标签
		const legendScale = d3.scaleLinear()
			.domain(colorScale.domain())
			.range([0, 120]);

		// 最小值标签
		legend.append("text")
			.attr("class", "legend-item")
			.attr("x", 0)
			.attr("y", 25)
			.style("font-size", "10px")
			.text("1");

		// 最大值标签
		legend.append("text")
			.attr("class", "legend-item")
			.attr("x", 120)
			.attr("y", 25)
			.style("font-size", "10px")
			.style("text-anchor", "end")
			.text("10");

		
			

		updateLegendTitle(field);
	}

	//---------------------------------------------------
	// Draw initial points
	//---------------------------------------------------
	const dots = inner.selectAll("circle")
		.data(data)
		.join("circle")
		.attr("cx", d => xScale(d.Daily_Screen_Time))
		.attr("cy", d => yScale(d.Sleep_Quality))
		.attr("r", 5)
		.attr("opacity", 0.85)
		.attr("fill", d => colorScale(d.Stress_Level))
		.on("mouseover", (event, d) => {
			tooltip.transition().duration(150).style("opacity", 1);
			tooltip.html(
				`<b>User:</b> ${d.id}<br>
				 <b>Screen Time:</b> ${d.Daily_Screen_Time}<br>
				 <b>Sleep Quality:</b> ${d.Sleep_Quality}<br>
				 <b>Stress:</b> ${d.Stress_Level}<br>
				 <b>Happiness:</b> ${d.Happiness_Index}`
			)
				.style("left", event.pageX + 15 + "px")
				.style("top", event.pageY - 28 + "px");
		})
		.on("mouseout", () => {
			tooltip.transition().duration(200).style("opacity", 0);
		});

	// 初始化图例
	createGradientLegend("Stress_Level");

	//---------------------------------------------------
	// Update color when dropdown changes
	//---------------------------------------------------
	d3.select("#scatterColorSelector").on("change", function () {
		const field = this.value; // Stress_Level 或 Happiness_Index

		dots.transition()
			.duration(500)
			.attr("fill", d => colorScale(d[field]));

		// 更新图例标题
		updateLegendTitle(field);
	});
}

