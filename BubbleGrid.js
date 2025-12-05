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

export default class BubbleGrid {
	constructor(container, data) {
		this.container = container;
		this.data = data;
		this.currentColorField = "Stress_Level";

		this.width = BUBBLE_CHART_WIDTH;
		this.height = BUBBLE_CHART_HEIGHT;
		this.margin = createMargins(this.width, this.height);

		this.plotWidth = this.width - this.margin.left - this.margin.right;
		this.plotHeight = this.height - this.margin.top - this.margin.bottom;

		this.svg = d3.select(container)
			.append("svg")
			.attr("width", this.width)
			.attr("height", this.height);

		this.inner = this.svg.append("g")
			.attr("transform", `translate(${this.margin.left},${this.margin.top})`);

		this.xValues = [0, 1, 2, 3, 4, 5, 6, 7];
		this.yValues = d3.range(0, 10, 1);

		this.xScale = d3.scaleBand()
			.domain(this.xValues).range([0, this.plotWidth]).padding(0.1);
		this.yScale = d3.scaleBand()
			.domain(this.yValues).range([this.plotHeight, 0]).padding(0.1);
		this.sizeScale = d3.scaleSqrt().domain([0, 20]).range([2, 30]);

		this.colorScale = d3.scaleLinear().domain([1, 3, 6, 8, 10])
			.range(["#0f7a3d", "#1a9850", "#ebc45b", "#d73027", "#ac1b13"]);

		this.tooltip = d3.select("body")
			.append("div")
			.attr("class", "tooltip")
			.style("opacity", 0);

		this.drawAxes();
		this.drawGrid();
		this.aggregateData();
		this.drawBubbles();
		this.drawLegend();
		this.update(this.currentColorField);
	}

	drawAxes() {
		// axes
		this.inner.append("g")
			.attr("transform", `translate(0,${this.plotHeight})`)
			.call(d3.axisBottom(this.xScale).tickSizeOuter(0))
			.style("font-size", "12px");

		this.inner.append("g")
			.call(d3.axisLeft(this.yScale).tickSizeOuter(0))
			.style("font-size", "12px");

		// labels
		this.svg.append("text")
			.attr("x", this.width / 2)
			.attr("y", this.height * 0.05)
			.attr("text-anchor", "middle")
			.style("font-size", "18px")
			.text("Exercise Frequency vs Days Without Social Media");

		this.svg.append("text")
			.attr("x", this.width / 2)
			.attr("y", this.height * 0.97)
			.attr("text-anchor", "middle")
			.style("font-size", "16px")
			.text("Exercise Frequency (days/week)");

		this.svg.append("text")
			.attr("transform", "rotate(-90)")
			.attr("x", -this.height / 2)
			.attr("y", this.height * 0.1)
			.attr("text-anchor", "middle")
			.style("font-size", "16px")
			.text("Days Without Social Media");
	}

	drawGrid() {
		// horizontal grid
		this.inner.selectAll(".horizontal-grid")
			.data(this.yValues)
			.enter().append("line")
			.attr("class", "horizontal-grid")
			.attr("x1", 2)
			.attr("x2", this.plotWidth)
			.attr("y1", d => this.yScale(d))
			.attr("y2", d => this.yScale(d))
			.attr("stroke", "#eee")
			.attr("stroke-width", 1);

		// vertical grid
		this.inner.selectAll(".vertical-grid")
			.data(this.xValues.slice(1))
			.enter().append("line")
			.attr("class", "vertical-grid")
			.attr("x1", d => this.xScale(d))
			.attr("x2", d => this.xScale(d))
			.attr("y1", 0)
			.attr("y2", this.plotHeight - 2)
			.attr("stroke", "#eee")
			.attr("stroke-width", 1);
	}

	aggregateData() {
		const grouped = d3.group(this.data,
			d => d.Exercise_Frequency,
			d => d.Days_Without_Social_Media
		);

		this.aggregatedData = [];
		for (const [xVal, yGroups] of grouped) {
			for (const [yVal, points] of yGroups) {
				const count = points.length;
				const avgValue = d3.mean(points, d => d[this.currentColorField]);
				this.aggregatedData.push({
					x: +xVal,
					y: +yVal,
					count,
					avgValue: avgValue || 0,
					points
				});
			}
		}

		const maxCount = d3.max(this.aggregatedData, d => d.count);
		this.sizeScale.domain([0, maxCount]);
	}

	drawBubbles() {
		this.bubbles = this.inner.selectAll(".bubble")
			.data(this.aggregatedData)
			.join("circle")
			.attr("class", "bubble")
			.attr("cx", d => this.xScale(d.x) + this.xScale.bandwidth() / 2)
			.attr("cy", d => this.yScale(d.y) + this.yScale.bandwidth() / 2)
			.attr("r", d => this.sizeScale(d.count))
			.attr("fill", d => this.colorScale(d.avgValue))
			.attr("opacity", 0.8)
			.attr("stroke", "white")
			.attr("stroke-width", 1.5)
			.style("cursor", "pointer")
			.on("mouseover", (event, d) => this.showTooltip(event, d))
			.on("mouseout", (event, d) => this.hideTooltip(event, d))
			.on("click", (event, d) => console.log("Selected grid cell:", d));
	}

	showTooltip(event, d) {
		d3.select(event.currentTarget).raise()
			.transition().duration(200)
			.attr("opacity", 1)
			.attr("stroke-width", 2.5);

		this.tooltip.style("opacity", 1).html(
			`<b>Exercise Frequency:</b> ${d.x}<br>
			 <b>Days Without Social Media:</b> ${d.y}<br>
			 <b>Number of People:</b> ${d.count}<br>
			 <b>Avg ${this.currentColorField.replace(/_/g, " ")}:</b> ${d.avgValue.toFixed(2)}`
		).style("left", (event.pageX + 15) + "px")
		 .style("top", (event.pageY - 20) + "px");
	}

	hideTooltip(event, d) {
		d3.select(event.currentTarget)
			.transition().duration(200)
			.attr("opacity", 0.8)
			.attr("stroke-width", 1.5);

		this.tooltip.style("opacity", 0);
	}

	drawLegend() {
		this.legend = this.svg.append("g")
			.attr("class", "legend")
			.attr("transform", `translate(${BUBBLE_CHART_WIDTH * 0.70}, ${BUBBLE_CHART_HEIGHT * 0.15})`);
	}

	updateLegend(field) {
		this.legend.selectAll("*").remove();

		this.legend.append("text")
			.attr("x", 50)
			.attr("y", -8)
			.style("font-size", "12px")
			.text(field.replace(/_/g, " "));

		const width = 160;
		const height = 12;
		const gradientId = "legend-gradient-" + field;

		let defs = this.svg.select("defs");
		if (defs.empty()) defs = this.svg.append("defs");
		defs.select("#" + gradientId).remove();

		const gradient = defs.append("linearGradient")
			.attr("id", gradientId)
			.attr("x1", "0%").attr("y1", "0%")
			.attr("x2", "100%").attr("y2", "0%");

		const domain = this.colorScale.domain();
        gradient.append("stop").attr("offset", "0%").attr("stop-color", this.colorScale(domain[0]));
		gradient.append("stop").attr("offset", "20%").attr("stop-color", this.colorScale(domain[1]));
		gradient.append("stop").attr("offset", "60%").attr("stop-color", this.colorScale(domain[2]));
		gradient.append("stop").attr("offset", "80%").attr("stop-color", this.colorScale(domain[3]));
		gradient.append("stop").attr("offset", "100%").attr("stop-color", this.colorScale(domain[4]));


		this.legend.append("rect")
			.attr("x", 0).attr("y", 0)
			.attr("width", width).attr("height", height)
			.style("fill", `url(#${gradientId})`);

		const labelGroup = this.legend.append("g")
			.attr("transform", "translate(0, 20)");
		labelGroup.append("text").attr("x", 0).attr("y", 0).text("1").style("font-size", "10px");
		labelGroup.append("text").attr("x", width).attr("y", 0).attr("text-anchor", "end").text("10").style("font-size", "10px");
	}

	update(field) {
		this.currentColorField = field;
		if (field === "Happiness_Index") {
			this.colorScale = d3.scaleLinear().domain([1, 3, 6, 8, 10])
				.range(["#ac1b13", "#d73027", "#ebc45b", "#1a9850", "#0f7a3d"]);
		} else if (field === "Stress_Level") {
			this.colorScale = d3.scaleLinear().domain([1, 3, 6, 8, 10])
				.range(["#0f7a3d", "#1a9850", "#ebc45b", "#d73027", "#ac1b13"]);
		}

		this.aggregateData();

		this.bubbles.data(this.aggregatedData)
			.transition()
			.duration(500)
			.attr("r", d => this.sizeScale(d.count))
			.attr("fill", d => this.colorScale(d.avgValue));

		this.updateLegend(field);
	}
}
