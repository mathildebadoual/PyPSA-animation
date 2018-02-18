
// Copyright 2018 Tom Brown

// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU Affero General Public License as
// published by the Free Software Foundation; either version 3 of the
// License, or (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.

// License and more information at:
// https://github.com/PyPSA/PyPSA-animation



function sum(array){
    var total = 0;
    for(var i=0; i < array.length; i++) { total += array[i]}
    return total
}


function half_pie(array, startAngle){
    var total = sum(array);
    var result = [];
    var angle = startAngle;
    for(var i=0; i < array.length; i++) {
	item = {};
	item["total"] = total;
	item["startAngle"] = angle;
	item["endAngle"] = angle + Math.PI*array[i]/total;
	angle = item["endAngle"];
	result.push(item);
    }
    return result;
}


//Width and height
var w = 500;
var h = 500;


//Scale flow and power
var flow_scale = 1;
var power_scale = 0.3;

//interval for animation update in milliseconds
var animation_interval = 150;


//Current snapshot index; value sets start point
var snapshot_index = 0;

//Define map projection

var projection = d3.geo.mercator() //utiliser une projection standard pour aplatir les pôles, voir D3 projection plugin
    .center([ 9.3, 52 ]) //comment centrer la carte, longitude, latitude
    .translate([ w/2, h/2 ]) // centrer l'image obtenue dans le svg
    .scale([ w/0.68]); // zoom, plus la valeur est petit plus le zoom est gros

//Define path generator
var path = d3.geo.path()
    .projection(projection);



//Create SVG
var svg = d3.select("#right")
    .append("svg")
    .attr("width", w)
    .attr("height", h);

var signs = ["positive","negative"];


var files_to_load = ["snapshots","carriers","power","flow","buses","links"];

var scenario = 2;

var season = "winter";

var network = {};

var animate_flows = true;


//recursively load files into network object
//function after is executed at the end

function load_data(scenario, season, after){

    var k = 0;

    function load_next(){

	if(k >= files_to_load.length){
	    after();
	    return;
	}

	var file_name = scenario + "-" + season + "/" + files_to_load[k] + ".json";

	d3.json(file_name, function(data){
	    network[files_to_load[k]] = data;
	    k++;
	    load_next();
	});
    }

    load_next();
}


//execute this function once all the data is loaded

function display_data(){

    document.getElementById("timeslide").max=network.snapshots.length-1;

    document.getElementById("timeslide").value = snapshot_index;

    document.getElementById("range").innerHTML=network.snapshots[snapshot_index];


    //Legend
    for(var k=0; k < signs.length; k++) {
	var sign=signs[k];

	// remove existing
	d3.select("#legend-" + sign).selectAll("svg").remove();

	var legendSVG = d3.select("#legend-" + sign)
	    .append("svg")
	    .attr("width",180)
	    .attr("height",network.carriers[sign].index.length*20);

	var legend = legendSVG.selectAll("g")
	    .data(network.carriers[sign].index)
	    .enter()
	    .append("g")
	    .attr("transform", function (d, i) {  return "translate(0," + (5 + i * 20) + ")" });

	legend.append("rect")
	    .attr("x",0)
	    .attr("y",0)
	    .attr("width", 10)
	    .attr("height", 10)
	    .style("fill", function (d, i) { return network.carriers[sign].color[i] });

	legend.append("text")
	    .attr("x",20)
	    .attr("y",10)
	    .text(function (d) { return d});
    }

    // remove existing
    d3.select("#legend-scale").selectAll("svg").remove();

    var legendSVG = d3.select("#legend-scale")
	.append("svg")
        .attr("width",180)
        .attr("height",120);

    //divide by 2 because only half of pie corresponds to total power
    legendSVG.append("circle").attr("cx",20).attr("cy",15).attr("r",(5/2)**0.5/power_scale).attr("fill","#FFFFFF").attr("stroke","black").attr("stroke-width",1);

    legendSVG.append("text").attr("x",40).attr("y",20).text("5 GW");

    legendSVG.append("circle").attr("cx",20).attr("cy",45).attr("r",(25/2)**0.5/power_scale).attr("fill","#FFFFFF").attr("stroke","black").attr("stroke-width",1);

    legendSVG.append("text").attr("x",40).attr("y",50).text("25 GW");

    legendSVG.append("rect").attr("x",0).attr("y",70).attr("width",30).attr("height",1/flow_scale).attr("fill","#999999");

    legendSVG.append("text").attr("x",40).attr("y",80).text("1 GW flow");

    legendSVG.append("rect").attr("x",0).attr("y",90).attr("width",30).attr("height",10/flow_scale).attr("fill","#999999");

    legendSVG.append("text").attr("x",40).attr("y",100).text("10 GW flow");


    // remove existing
    d3.select("g#lines").remove();

    line_layer = svg.append("g")
        .attr("id","lines");


    lineFunction = d3.svg.line()
        .x(function(d) { return d[0] })
        .y(function(d) { return d[1] })
        .interpolate("linear");

    if(animate_flows){
	var cls = "flowline-animated";
    }
    else{
	var cls = "flowline";
    }

    lines = line_layer.selectAll("path")
	.data(network.links.index)
	.enter()
	.append("path")
	.attr("d", function(d, i) {var from = 0; if(network.flow[snapshot_index][i] < 0){from = 1}; return lineFunction([projection([network.links["x" + from][i],network.links["y" + from][i]]),projection([network.links["x" + (1-from)][i],network.links["y" + (1-from)][i]])])})
        .attr("class", cls)
        .attr("stroke-width", function(d, i) { return Math.abs(network.flow[snapshot_index][i])/flow_scale});


    // This is a function which transforms arc data into a path
    arc_path = d3.svg.arc()
        .innerRadius(0);

    // This is a function which turns a list of numbers into arc data (start angle, end angle,  etc.)
    pie = d3.layout.pie()
	.sort(null);

    startAngle = {"positive" : -Math.PI/2, "negative" : Math.PI/2};

    sign_layer = {};

    sign_locations = {};

    for(var k=0; k < signs.length; k++) {

	sign = signs[k];

	// remove existing
	d3.select("g#"+sign).remove();

	sign_layer[sign] = svg.append("g").attr("id",sign);


	sign_locations[sign] = sign_layer[sign].selectAll("g")
            .data(network.power[sign])
            .enter()
            .append("g")
            .attr("transform", function(d,i) { return "translate(" + projection([network.buses.x[i],network.buses.y[i]])[0] +","+ projection([network.buses.x[i],network.buses.y[i]])[1] + ")" } );



    sign_locations[sign].selectAll("path")
            .data(function(d) {return half_pie(d[snapshot_index], startAngle[sign])})
        .enter()
        .append("path")
        .attr("d", function(d) { return arc_path.outerRadius(d["total"]**0.5/power_scale)(d)})
	    .attr("class",sign)
        .style("fill", function(d, i) { return network.carriers[sign].color[i] });

    };
}



//Load in GeoJSON data
d3.json("ne_50m_admin_0_countries_simplified.json", function(json) {

    countries = svg.append("g")
        .attr("id","countries");

    //Bind data and create one path per GeoJSON feature
    countries.selectAll("path")
	.data(json.features)
	.enter()
	.append("path")
	.attr("d", path)
	.attr("stroke", "rgba(8, 81, 156, 0.2)")
	.attr("fill", "rgba(8, 81, 156, 0.01)");



    load_data(scenario, season, display_data);
});



// when the scenario changes, reload the data

d3.selectAll("input[name='scenario']").on("change", function(){
    scenario = this.value;
    console.log("scenario changed to", scenario);
    load_data(scenario, season, display_data);
});


// when the season changes, reload the data

d3.selectAll("input[name='season']").on("change", function(){
    season = this.value;
    console.log("season changed to", season);
    load_data(scenario, season, display_data);
});



// when the input range changes update the value
d3.select("#timeslide").on("input", function() {
    update(+this.value);
});


function update(value) {
    snapshot_index = value;
    document.getElementById("range").innerHTML=network.snapshots[snapshot_index];

    line_layer.selectAll("path")
	.attr("d", function(d, i) {var from = 0; if(network.flow[snapshot_index][i] < 0){from = 1}; return lineFunction([projection([network.links["x" + from][i],network.links["y" + from][i]]),projection([network.links["x" + (1-from)][i],network.links["y" + (1-from)][i]])])})
        .attr("stroke-width", function(d, i) { return Math.abs(network.flow[snapshot_index][i])/flow_scale});

    for(var k=0; k < signs.length; k++) {

	sign = signs[k];

	// don't need enter() and append() here...
	sign_locations[sign].selectAll("path")
            .data(function(d) {return half_pie(d[snapshot_index], startAngle[sign])})
        .attr("d", function(d) { return arc_path.outerRadius(d["total"]**0.5/power_scale)(d)})
        .style("fill", function(d, i) { return network.carriers[sign].color[i] });
    }
}



// Inspired by https://bl.ocks.org/officeofjane/47d2b0bfeecfcb41d2212d06d095c763
var playButton = d3.select("#play-button");

var moving = false;

playButton
    .on("click", function() {
	var button = d3.select(this);
	if (button.text() == "Pause") {
	    moving = false;
	    clearInterval(timer);
	    // timer = 0;
	    button.text("Play");
	} else {
	    if(snapshot_index == network.snapshots.length-1){
		snapshot_index = -1;
	    }
	    moving = true;
	    timer = setInterval(step, animation_interval);
	    button.text("Pause");
	}
	console.log("Slider moving: " + moving);
    });

function step() {

    if(snapshot_index == network.snapshots.length-1){
	moving = false;
	clearInterval(timer);
	// timer = 0;
	playButton.text("Play");
	console.log("Slider moving: " + moving);
    }
    else{
	snapshot_index += 1;
	document.getElementById("timeslide").value = snapshot_index;
	update(snapshot_index);
    }
}




var flowButton = d3.select("#flow-button");

flowButton
    .on("click", function() {
	var button = d3.select(this);
	if (button.text() == "Toggle flow animation: On") {
	    animate_flows = false;
	    line_layer.selectAll("path")
		.attr("class", "flowline");
	    button.text("Toggle flow animation: Off");
	} else {
	    animate_flows = true;
	    line_layer.selectAll("path")
	        .attr("class", "flowline-animated");
	    button.text("Toggle flow animation: On");
	}

    });
