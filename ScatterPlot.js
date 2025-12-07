var SCATTER_CHART_WIDTH = 700;
var SCATTER_CHART_HEIGHT = 490;

function createMargins(width, height) {
	return {
		top: height * 0.12,
		right: width * 0.12,
		bottom: height * 0.12,
		left: width * 0.12
	};
}

export default class ScatterPlot {
	constructor(container, data, selectionManager) {
		this.container = container;
		this.data = data;
		this.selectionManager = selectionManager;
		this.selectedIDs = new Set();

		this.width = SCATTER_CHART_WIDTH;
		this.height = SCATTER_CHART_HEIGHT;
		this.margin = createMargins(this.width, this.height);
		
		this.plotWidth = this.width - this.margin.left - this.margin.right;
		this.plotHeight = this.height - this.margin.top - this.margin.bottom;

		this.svg = d3.select(container)
			.append("svg")
			.attr("width", this.width)
			.attr("height", this.height);

		this.inner = this.svg.append("g")
			.attr("transform", `translate(${this.margin.left},${this.margin.top})`);

		// scales
		this.xScale = d3.scaleLinear().domain([0, 11]).range([0, this.plotWidth]).nice();
		this.yScale = d3.scaleLinear().domain([1, 10]).range([this.plotHeight, 0]).nice();

		// default color scale (Stress)
		this.colorScale = d3.scaleLinear().domain([1, 3, 6, 8, 10])
			.range(["#0f7a3d", "#1a9850", "#ebc45b", "#d73027", "#ac1b13"]);

		// tooltip
		this.tooltip = d3.select("body")
			.append("div")
			.attr("class", "tooltip")
			.style("opacity", 0);

		// draw
		this.drawAxes();
		this.drawGrid();
		this.drawDots();
		this.drawLegend();

		// brush setup
		this.brush = d3.brush()
			.extent([[0, 0], [this.plotWidth, this.plotHeight]])
			.on("end", (event) => this.handleBrush(event));
		this.inner.append("g")
			.attr("class", "brush")
			.call(this.brush);
		this.inner.select(".brush").lower();

		this.update("Stress_Level"); // initial color field
	}

	drawAxes() {
		// axes
		this.inner.append("g")
			.attr("transform", `translate(0,${this.plotHeight})`)
			.call(d3.axisBottom(this.xScale)).style("font-size", "12px");

		this.inner.append("g")
			.call(d3.axisLeft(this.yScale)).style("font-size", "12px");

		// labels
		this.svg.append("text")
			.attr("x", this.width / 2)
			.attr("y", this.height * 0.05)
			.attr("text-anchor", "middle")
			.style("font-size", "18px")
			.text("Daily Screen Time vs Sleep Quality");

		this.svg.append("text") 
			.attr("x", this.width / 2) 
			.attr("y", this.height * 0.97) 
			.attr("text-anchor", "middle") 
			.style("font-size", "16px") 
			.text("Daily Screen Time (hours)"); 

		this.svg.append("text") 
			.attr("transform", "rotate(-90)") 
			.attr("x", -this.height / 2) 
			.attr("y", this.height * 0.1) 
			.attr("text-anchor", "middle") 
			.style("font-size", "16px") 
			.text("Sleep Quality");
	}

	drawGrid() {
		// horizontal grid
		this.inner.selectAll(".horizontal-grid")
			.data(this.yScale.ticks(10).filter(d => d > 1))
			.enter().append("line")
			.attr("class", "horizontal-grid")
			.attr("x1", 1)
			.attr("x2", this.plotWidth + 2)
			.attr("y1", d => this.yScale(d))
			.attr("y2", d => this.yScale(d))
			.attr("stroke", "#eee")
			.attr("stroke-width", 1);

		// vertical grid
		this.inner.selectAll(".vertical-grid")
			.data(this.xScale.ticks(10).filter(d => d > 0))
			.enter().append("line")
			.attr("class", "vertical-grid")
			.attr("x1", d => this.xScale(d))
			.attr("x2", d => this.xScale(d))
			.attr("y1", -5)
			.attr("y2", this.plotHeight - 2)
			.attr("stroke", "#eee")
			.attr("stroke-width", 1);
	}

	drawDots() {
		this.dots = this.inner.selectAll("circle")
			.data(this.data)
			.join("circle")
			.attr("r", 5)
			.attr("cx", d => this.xScale(d.Daily_Screen_Time))
			.attr("cy", d => this.yScale(d.Sleep_Quality))
			.attr("opacity", 0.8)
			.attr("fill", d => this.colorScale(d.Stress_Level))
			.attr("stroke", "white")
			.attr("stroke-width", 0.1)
			.on("mouseover", (event, d) => this.showTooltip(event, d))
			.on("mouseout", (event) => this.hideTooltip(event));	
	}

	drawLegend() {
		this.legend = this.svg.append("g")
			.attr("class", "legend")
			.attr("transform", `translate(${this.width * 0.70}, ${this.height * 0.15})`);
	}

	showTooltip(event, d) {
		if(+d3.select(event.currentTarget).attr("opacity") < 0.5) return; // not selected, no tooltip
		d3.select(event.currentTarget).raise()
			.transition().duration(200)
			.attr("r", 7).attr("opacity", 1).attr("stroke-width", 1);

		this.tooltip.style("opacity", 1).html(
			`<b>Daily Screen Time:</b> ${d.Daily_Screen_Time}<br>
			 <b>Sleep Quality:</b> ${d.Sleep_Quality}<br>
			 <b>Stress Level:</b> ${d.Stress_Level}<br>
			 <b>Happiness:</b> ${d.Happiness_Index}`
		).style("left", event.pageX + 15 + "px")
		 .style("top", event.pageY - 20 + "px");
	}
	hideTooltip(event) {
		if(+d3.select(event.currentTarget).attr("opacity") < 0.5) return; // not selected, no tooltip
		d3.select(event.currentTarget)
			.transition().duration(200)
			.attr("r", 5).attr("opacity", 0.85).attr("stroke-width", 0.1);
		this.tooltip.style("opacity", 0);
	}

	update(field) {
		// update color scale
		if (field === "Happiness_Index") {
			this.colorScale = d3.scaleLinear().domain([1, 3, 6, 8, 10])
				.range(["#ac1b13", "#d73027", "#ebc45b", "#1a9850", "#0f7a3d"]);
		} else if (field === "Stress_Level") {
			this.colorScale = d3.scaleLinear().domain([1, 3, 6, 8, 10])
				.range(["#0f7a3d", "#1a9850", "#ebc45b", "#d73027", "#ac1b13"]);
		}

		// update dots
		this.dots.transition().duration(500)
			.attr("fill", d => this.colorScale(d[field]));

		// update legend
		this.updateLegend(field);
	}

	updateLegend(field) {
		this.legend.selectAll("*").remove();

		// legend title
		this.legend.append("text")
			.attr("x", 50)
			.attr("y", -8)
			.style("font-size", "12px")
			.text(field.replace(/_/g, " "));

		const boxSize = 15;
		const boxPadding = 1;
		const levels = d3.range(1, 11);
		const boxGroup = this.legend.append("g")
			.attr("transform", "translate(0, 0)");

		boxGroup.selectAll("rect")
			.data(levels)
			.join("rect")
			.attr("x", (d, i) => i * (boxSize + boxPadding))
			.attr("y", 0)
			.attr("width", boxSize)
			.attr("height", 12)
			.attr("fill", d => this.colorScale(d));

		const labelGroup = this.legend.append("g")
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

	// WIP: brush-and-link
	handleBrush(event) {
		const selection = event.selection;
		if (!selection) {
			this.selectionManager({ scatter: [] });
			return;
		}
		const [[x0, y0], [x1, y1]] = selection;
		const selected = this.data
			.filter(d => {
				const x = this.xScale(d.Daily_Screen_Time);
				const y = this.yScale(d.Sleep_Quality);
				return x0 <= x && x <= x1 && y0 <= y && y <= y1;
			})
			.map(d => d.id);

		this.selectionManager({ scatter: selected });
	}

	applySelection(selectedIDs) {
		this.dots.transition().duration(150)
			.attr("opacity", d => selectedIDs.size === 0 || selectedIDs.has(d.id) ? 0.8 : 0.1);
		if (selectedIDs.size > 0) {
			this.dots.filter(d => selectedIDs.has(d.id))
				.raise();  // 移到 SVG DOM 的最前面
		}
	}
}
