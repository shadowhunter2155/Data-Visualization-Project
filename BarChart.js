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


export default class BarChart {
	constructor(container, data, field, binWidth, isInterval, activeFiltersRef, selectionManager) {
		this.container = container;
		this.data = data;
		this.field = field;
		this.binWidth = binWidth;
		this.isInterval = isInterval;
		this.activeFilters = activeFiltersRef;
		this.selectionManager = selectionManager;
		this.selectedIDs = new Set();

		this.width = BAR_CHART_WIDTH;
		this.height = BAR_CHART_HEIGHT;
		this.margin = createMargins(this.width, this.height);

		this.plotWidth = this.width - this.margin.left - this.margin.right;
		this.plotHeight = this.height - this.margin.top - this.margin.bottom;
		
		const allKeys = data.map(d => isInterval
				? Math.round(d[field] / this.binWidth) * this.binWidth
				: d[field] );

		this.xDomainFixed = [
			- 0.1 - this.binWidth / 2,
			d3.max(allKeys) + this.binWidth / 2
		];

		this.allBins = Array.from(
			d3.rollup(data,
				v => v.length,
				d => this.isInterval
					? Math.round(d[this.field] / this.binWidth) * this.binWidth
					: d[this.field]), ([key]) => key)
			.sort((a, b) => a - b);

		this.svg = d3.select(container).append("svg")
			.attr("width", this.width).attr("height", this.height);

		this.inner = this.svg.append("g")
			.attr("transform", `translate(${this.margin.left},${this.margin.top})`);
			
		// scales
		this.xScale = d3.scaleLinear().range([0, this.plotWidth]);
		this.yScale = d3.scaleLinear().range([this.plotHeight, 0]);

		this.xAxisG = this.inner.append("g").attr("transform", `translate(0, ${this.plotHeight})`);
		this.yAxisG = this.inner.append("g");

		// color palettes
		this.genderColors = {
			"Male": "#4A90E2",
			"Female": "#FF69B4",
			"Other": "#9E9E9E"
		};
		this.socialColors = {
			"Facebook": "#1f77b4",
			"Instagram": "#2ca02c",
			"LinkedIn": "#8c564b",			
			"TikTok": "#ff7f0e",
			"X (Twitter)": "#9467bd",
			"YouTube": "#d62728"
		};

		this.colorScale = d3.scaleOrdinal().range(["#1f77b4"]);

		// tooltip
		this.tooltip = d3.select("body")
			.append("div")
			.attr("class", "tooltip")
			.style("opacity", 0);

		// title
		this.svg.append("text")
			.attr("x", this.width / 2)
			.attr("y", 14)
			.attr("text-anchor", "middle")
			.style("font-size", "12px")
			.text(this.field.replace(/_/g, " "));

		// brush setup
		this.brush = d3.brushX()
			.extent([[0, 0], [this.plotWidth, this.plotHeight]])
			.on("end", (event) => this.handleBrush(event));
		this.inner.append("g")
			.attr("class", "brush")
			.call(this.brush);
		this.inner.select(".brush").lower();

		this.update("");  // initial render
	}
	
	prepareData(groupBy) {
		let filtered = this.data;
		if (groupBy !== "" && this.activeFilters[groupBy]?.length > 0) {
			const idSet = new Set(this.activeFilters[groupBy]);
			filtered = filtered.filter(d => idSet.has(d.id));
		}
		// no filter
		if (groupBy === "") {
			const grouped = d3.rollups(
				filtered,
				v => v.length,
				d => this.isInterval ? Math.round(d[this.field] / this.binWidth) * this.binWidth : d[this.field]
			);
			const barData = this.allBins.map(bin => {
				const found = grouped.find(([key]) => key === bin);
				return { key: bin, values: [{ group: "All", value: found ? found[1] : 0 }] };
			});
			return { groups: ["All"], barData };
		}
		// yes filter
		let groups = [];
		if (groupBy === "Gender") groups = Object.keys(this.genderColors);
		else groups = Object.keys(this.socialColors);

		const grouped = d3.group(
			filtered,
			d => this.isInterval
				? Math.round(d[this.field] / this.binWidth) * this.binWidth
				: d[this.field]
		);

		const barData = this.allBins.map(bin => {
			const values = grouped.get(bin) || [];
			const counts = d3.rollups(values, v => v.length, d => d[groupBy]);
			return {
				key: bin,
				values: groups.map(g => ({ group: g,
					value: counts.find(c => c[0] === g)?.[1] || 0
				}))
			};
		});

		return { groups, barData };
	}

	// update
	update(groupBy) {
		const { groups, barData } = this.prepareData(groupBy);
		// update color scale
		if (groupBy === "Gender")
			this.colorScale = d3.scaleOrdinal().domain(groups).range(Object.values(this.genderColors));
		else if (groupBy === "Social_Media_Platform")
			this.colorScale = d3.scaleOrdinal().domain(groups).range(Object.values(this.socialColors));
		else
			this.colorScale = d3.scaleOrdinal().domain(groups).range(["#1f77b4"]);

		// x-axis scale
		this.xScale.domain(this.xDomainFixed);

		const barWidth = Math.min( this.plotWidth / barData.length * 0.95,
			(this.plotWidth / (this.xDomainFixed[1] - this.xDomainFixed[0])) *	this.binWidth * 0.95);

		// stack
		const stackData = barData.map(d => {
			let obj = { key: d.key };
			d.values.forEach(v => obj[v.group] = v.value);
			return obj;
		});

		const stacked = d3.stack().keys(groups).value((d, k) => d[k] || 0)(stackData);

		this.yScale.domain([0, d3.max(stacked, layer => d3.max(layer, d => d[1])) * 1.05]).nice();

		this.xAxisG.call(d3.axisBottom(this.xScale).tickSizeOuter(0));
		this.yAxisG.call(d3.axisLeft(this.yScale).ticks(6).tickSizeOuter(0));

		// draw bars
		const layers = this.inner.selectAll(".layer")
			.data(stacked, d => d.key);
		
		layers.exit().remove();

		const layerEnter = layers.enter()
			.append("g")
			.attr("class", "layer")
			.attr("fill", d => this.colorScale(d.key));

		layerEnter.selectAll("rect")
			.data(d => d)
			.enter()
			.append("rect")
			.attr("x", d => this.xScale(+d.data.key) - barWidth / 2)
			.attr("width", barWidth)
			.attr("y", this.plotHeight)
			.attr("height", 0)
			.attr("opacity", 1)
			.on("mouseover", (event, d) => this.showTooltip(event, d, groupBy))
			.on("mouseout", (event) => this.hideTooltip(event));
			
		
		layers.merge(layerEnter)
			.attr("fill", d => this.colorScale(d.key))
			.selectAll("rect")
			.data(d => d)
			.transition()
			.duration(600)
			.attr("y", d => this.yScale(d[1]))
			.attr("height", d => this.yScale(d[0]) - this.yScale(d[1]));
	}

	// tooltips
	showTooltip(event, d, groupBy) {
		if(+d3.select(event.currentTarget).attr("opacity") < 0.5) return; // not selected, no tooltip
		const groupName = d3.select(event.currentTarget.parentNode).datum().key;
		const count = d[1] - d[0];
		let valueText = this.isInterval
			? `<b>Value:</b> ${+d.data.key - this.binWidth / 2} - ${+d.data.key + this.binWidth / 2}`
			: `<b>Value:</b> ${d.data.key}`;

		let html = `<b>Count:</b> ${count}<br>
			${valueText}`;
		if (groupBy !== "") html += `<br><b>Group:</b> ${groupName}`;
		this.tooltip
			.style("opacity", 1)
			.html(html)
			.style("left", (event.pageX + 15) + "px")
			.style("top", (event.pageY - 20) + "px");
	}
	hideTooltip(event) {
		if(+d3.select(event.currentTarget).attr("opacity") < 0.5) return; // not selected, no tooltip
		this.tooltip.style("opacity", 0);
	}

	// TODO: brush-and-link 
	handleBrush(event) {
		const selection = event.selection;
		if (!selection) {
			// brush cleared
			this.selectionManager({ [this.field]: [] });
			return;
		}
		const [x0, x1] = selection;

		// find data
		const selectedIDs = this.data
			.filter(d => {
				const value = this.isInterval
					? Math.round(d[this.field] / this.binWidth) * this.binWidth
					: d[this.field];

				const px = this.xScale(value);
				return px >= x0 && px <= x1;
			})
			.map(d => d.id);

		this.selectionManager({ [this.field]: selectedIDs });
	}

	applySelection(selectedIDs) {
		// selectedIDs Set
		this.inner.selectAll(".layer rect")
			.transition().duration(200)
			.attr("opacity", d => {
				// find all id in bin
				const value = this.isInterval
					? Math.round(d.data.key / this.binWidth) * this.binWidth
					: d.data.key;
				const idsInBin = this.data
					.filter(row => {
						const v = this.isInterval
							? Math.round(row[this.field] / this.binWidth) * this.binWidth
							: row[this.field];
						return v === value;
					})
					.map(row => row.id);
				const matched = idsInBin.some(id => selectedIDs.has(id));
				return selectedIDs.size === 0 || matched ? 1.0 : 0.15;
			});
	}
}