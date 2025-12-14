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
	constructor(container, data, selectionManager) {
		this.container = container;
		this.data = data;
		this.currentColorField = "Stress_Level";
		this.selectionManager = selectionManager;
		this.selectedIDs = new Set();

		this.width = BUBBLE_CHART_WIDTH;
		this.height = BUBBLE_CHART_HEIGHT;
		this.margin = createMargins(this.width, this.height);

		this.plotWidth = this.width - this.margin.left - this.margin.right;
		this.plotHeight = this.height - this.margin.top - this.margin.bottom;

		this.svg = d3.select(container)
			.append("svg")
			.attr("width", this.width)
			.attr("height", this.height);

		this.inner = this.svg.append("g").attr("transform", `translate(${this.margin.left},${this.margin.top})`);
		// setting overlayers
		this.baseLayer = this.inner.append("g").attr("class", "base-layer");
		this.overlayLayer = this.inner.append("g").attr("class", "overlay-layer");

		this.xValues = [0, 1, 2, 3, 4, 5, 6, 7];
		this.yValues = d3.range(0, 10, 1);

		// scales
		this.xScale = d3.scaleBand().domain(this.xValues).range([0, this.plotWidth]).padding(0.1);
		this.yScale = d3.scaleBand().domain(this.yValues).range([this.plotHeight, 0]).padding(0.1);
		this.sizeScale = d3.scaleSqrt().domain([0, 20]).range([2, 30]);

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
		this.aggregateData(this.data);
		this.drawBubbles();
		this.drawLegend();

		// brush setup
		this.brush = d3.brush()
			.extent([[0, 0], [this.plotWidth, this.plotHeight]])
			.on("end", (event) => this.handleBrush(event));
		this.inner.append("g")
			.attr("class", "brush")
			.call(this.brush);
		this.inner.select(".brush").lower();
		
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
		
		// make them not selectable
		this.svg.selectAll("text")
			.style("user-select", "none")
			.style("-webkit-user-select", "none")
			.style("-moz-user-select", "none")
			.style("-ms-user-select", "none");

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
			.attr("stroke-width", 1).lower();

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
			.attr("stroke-width", 1).lower();
	}

	aggregateData(data) {
		const grouped = d3.group(data,
			d => d.Exercise_Frequency,
			d => d.Days_Without_Social_Media
		);
		this.aggregatedData = [];
		for (const [xVal, yGroups] of grouped) {
			for (const [yVal, points] of yGroups) {
				this.aggregatedData.push({
					x: +xVal,
					y: +yVal,
					count: points.length,
					avgValue: d3.mean(points, d => d[this.currentColorField]) || 0,
					points: points,
					ids: points.map(p => p.id)
				});
			}
		}
		const maxCount = d3.max(this.aggregatedData, d => d.count);
		this.sizeScale.domain([0, maxCount]);
	}

	drawBubbles() {
		this.baseBubbles = this.baseLayer.selectAll(".base-bubble")
			.data(this.aggregatedData)
			.join("circle")
			.attr("class", "base-bubble")
			.attr("cx", d => this.xScale(d.x) + this.xScale.bandwidth() / 2)
			.attr("cy", d => this.yScale(d.y) + this.yScale.bandwidth() / 2)
			.attr("r", d => this.sizeScale(d.count))
			.attr("fill", d => this.colorScale(d.avgValue))
			.attr("opacity", 0.8)
			.attr("stroke", "white")
			.attr("stroke-width", 1.5)
			.on("mouseover", (event, d) => this.showTooltip(event, d, false))
			.on("mouseout", (event, d) => this.hideTooltip(event, d, false));

		this.overlayBubbles = this.overlayLayer.selectAll(".overlay-bubble")
			.data([])
			.join("circle")
			.attr("class", "overlay-bubble")
			.style("pointer-events", "none");
	}

	showTooltip(event, d, isOverlay = false) {
		const opacity = +d3.select(event.currentTarget).attr("opacity");
		if(opacity < 0.5) return;

		d3.select(event.currentTarget).raise()
				.transition().duration(200)
				.attr("opacity", 1)
				.attr("stroke-width", 2.5);

		this.tooltip.style("opacity", 1).html(
				`<b>Exercise Frequency:</b> ${d.x}<br>
				 <b>Days Without Social Media:</b> ${d.y}<br>
				 <b>Number of Selected People:</b> ${isOverlay ? d.selectedCount : d.count}<br>
				 <b>Avg ${this.currentColorField.replace(/_/g, " ")}:</b> ${d.avgValue.toFixed(2)}<br>`
					+ (isOverlay ? `<i>(Selected subset)</i>` : ``)
			).style("left", (event.pageX + 15) + "px")
			 .style("top", (event.pageY - 20) + "px");
	}

	hideTooltip(event, d, isOverlay = false) {
		const opacity = +d3.select(event.currentTarget).attr("opacity");
		if(opacity < 0.5) return;
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

		this.aggregateData(this.data);

		this.baseBubbles.data(this.aggregatedData)
			.transition()
			.duration(500)
			.attr("r", d => this.sizeScale(d.count))
			.attr("fill", d => this.colorScale(d.avgValue));

		this.updateLegend(field)
	}
	// WIP: brush-and-link
	handleBrush(event) {
		if (!event.selection) {
			this.updateBaseBubbles([]);
			this.updateOverlayBubbles([]);
			this.selectionManager({ bubble: [] });
			return;
		}
		const { selectedCells, selectedIDs } = this.getSelectedCellsByBrush(event.selection);

		this.updateBaseBubbles(selectedCells);
		this.updateOverlayBubbles(selectedCells);
		this.selectionManager({ bubble: selectedIDs });
	}

	applySelection(selectedIDs) {
		if (!selectedIDs || selectedIDs.size === 0 || selectedIDs.size === this.data.length) {
			this.updateBaseBubbles([]);
			this.updateOverlayBubbles([]);
			return;
		}
		const selectedCells = this.getSelectedCellsByIDs(selectedIDs);
		this.updateBaseBubbles(selectedCells);
		this.updateOverlayBubbles(selectedCells);
	}

	// helpers
	getCellCenter(cell) {
		return {
			x: this.xScale(cell.x) + this.xScale.bandwidth() / 2,
			y: this.yScale(cell.y) + this.yScale.bandwidth() / 2
		};
	}
	getSelectedCellsByBrush(selection) {
		const [[x0, y0], [x1, y1]] = selection;
		const selectedCells = [];
		const selectedIDs = [];

		this.aggregatedData.forEach(cell => {
			const { x, y } = this.getCellCenter(cell);
			const hit = x0 <= x && x <= x1 && y0 <= y && y <= y1;
			if (!hit) return;

			selectedCells.push({
				x: cell.x,
				y: cell.y,
				selectedCount: cell.points.length,
				avgValue: d3.mean(cell.points, p => p[this.currentColorField]) || 0,
				points: cell.points,
				ids: cell.points.map(p => p.id)
			});

			selectedIDs.push(...cell.points.map(p => p.id));
		});

		return { selectedCells, selectedIDs };
	}
	getSelectedCellsByIDs(selectedIDs) {
		const selectedCells = [];

		this.aggregatedData.forEach(cell => {
			const selectedPoints = cell.points.filter(p => selectedIDs.has(p.id));
			if (!selectedPoints.length) return;

			selectedCells.push({
				x: cell.x,
				y: cell.y,
				selectedCount: selectedPoints.length,
				avgValue: d3.mean(selectedPoints, p => p[this.currentColorField]) || 0,
				points: selectedPoints,
				ids: selectedPoints.map(p => p.id)
			});
		});

		return selectedCells;
	}
	updateBaseBubbles(selectedCells) {
		const hasSelection = selectedCells.length > 0;
		this.baseBubbles.transition().duration(200)
			.attr("opacity", hasSelection ? 0.2 : 0.8)
			.attr("stroke-width", hasSelection ? 1 : 1.5);
	}
	updateOverlayBubbles(selectedCells) {
		this.overlayBubbles = this.overlayLayer
			.selectAll(".overlay-bubble")
			.data(selectedCells, d => `${d.x}-${d.y}`)
			.join(
				enter => enter.append("circle")
					.attr("class", "overlay-bubble")
					.attr("cx", d => this.getCellCenter(d).x)
					.attr("cy", d => this.getCellCenter(d).y)
					.attr("r", 0)
					.attr("fill", d => this.colorScale(d.avgValue))
					.attr("opacity", 0.8)
					.attr("stroke", "white")
					.attr("stroke-width", 1.5)
					.style("pointer-events", "all")
					.on("mouseover", (e, d) => this.showTooltip(e, d, true))
					.on("mouseout", (e, d) => this.hideTooltip(e, d, true))
					.call(sel => sel.transition().duration(400)
						.attr("r", d => this.sizeScale(d.selectedCount))
					),
				update => update
					.transition().duration(400)
					.attr("cx", d => this.getCellCenter(d).x)
					.attr("cy", d => this.getCellCenter(d).y)
					.attr("r", d => this.sizeScale(d.selectedCount))
					.attr("fill", d => this.colorScale(d.avgValue)),
				exit => exit.transition().duration(200)
					.attr("r", 0)
					.remove()
			);
	}

	// TODO: beeswarm plot for clicking bubble

}

// TODO: beeswarm plot for clicking bubble
class BeeswarmPlot {

}
