import BarChart from './BarChart.js';
import BubbleGrid from './BubbleGrid.js';
import ScatterPlot from './ScatterPlot.js';

let activeFilters = {
	Gender: [],
	Social_Media_Platform: [],
	Age: [],
	Daily_Screen_Time: [],
	Sleep_Quality: [],
	Days_Without_Social_Media: [],
	Exercise_Frequency: [],
	Happiness_Index: [],
	Gender: [],
	Social_Media_Platform: [],
	Scatter: [],
	Bubble: []
};

let selectedIDs = new Set();
let allCharts = {};

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
		const chart = new BarChart(
			"#" + cfg.id,
			data,
			cfg.field,
			cfg.bin_width,
			cfg.isInterval,
			activeFilters,
			selectionManager
		);
		barCharts.push(chart);
		allCharts[cfg.id] = chart;
	});
	// dropdown change listener
	d3.select("#groupSelector").on("change", function () {
		const groupBy = this.value;
		barCharts.forEach(chart => chart.update(groupBy));
		updateFilterOptions(groupBy);
	});

	// init scatter chart
	let scatterChart = new ScatterPlot("#scatter", data, selectionManager);
	let bubbleChart = new BubbleGrid("#bubble", data, selectionManager);
	allCharts.scatter = scatterChart;
	allCharts.bubble = bubbleChart;

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
	
	// WIP: brush-and-link system
	function selectionManager(update) {
		for (let key in update) {
			activeFilters[key] = update[key];
		}
		// intersect
		let sets = Object.values(activeFilters)
			.filter(arr => Array.isArray(arr) && arr.length > 0)
			.map(arr => new Set(arr));

		let finalSet = new Set();
		if (sets.length === 0) { // no selected
			data.forEach(d => finalSet.add(d.id));
		} else {
			finalSet = sets.reduce((a, b) => {
				return new Set([...a].filter(x => b.has(x)));
			});
		}
		// update all
		for (let key in allCharts) {
			if (allCharts[key].applySelection)
				allCharts[key].applySelection(finalSet);
		}
		selectedIDs = finalSet;
	}
});

