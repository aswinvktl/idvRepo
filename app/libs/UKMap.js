import UK from '../libs/uk.js';

export default class UKMap{

    #width;
    #height;

    #svg;
    #mapGroup;

    #projection;
    #path;

    #zoom;
    #zoomScale

    #ukUnits;
    #ukCities;
    #ukBorders;
    #ukCoast;

    // constructor
    constructor(container, width, height){
        this.#width = width;
        this.#height = height;

        // setting up selections
        this.#svg = d3.select(container).append('svg')
            .classed('visualisation map', true)
            .attr('width', width)
            .attr('height', height);
        this.#mapGroup = this.#svg.append('g')
            .classed('map', true);

        // setting the zoom
        this.#setZoom();

        // getting the TopoJSON objects
        this.#ukUnits = topojson.feature(UK, UK.objects.subunits);
        this.#ukCities = topojson.feature(UK, UK.objects.places);
        this.#ukBorders = topojson.mesh(UK, UK.objects.subunits, (a,b)=>a!==b);
        this.#ukCoast = topojson.mesh(UK, UK.objects.subunits, (a,b)=>a==b);
        // filtering cities to only a subset
        let cities = ['Aberdeen', 'Belfast', 'Cambridge', 'Cardiff', 'Edinburgh', 'Exeter',
                      'Glasgow', 'London', 'Manchester', 'Newcastle', 'Oxford', 'York' ]
        this.#ukCities.features = this.#ukCities.features.filter(f=>{
            return cities.includes(f.properties.name)
        })

        // rendering the base map
        this.#renderMap()
    }

    // function to set the zoom behaviour
    #setZoom(){
        this.#zoomScale = 1;
        this.#zoom = d3.zoom()
            .extent([[0,0], [this.#width,this.#height]])
            .translateExtent([[0,0], [this.#width,this.#height]])
            .scaleExtent([1,8])
            .on('zoom', ({transform})=>{
                // applies transform and call render map to update zoom scales
                this.#mapGroup.attr('transform', transform);
                if (transform.k !== this.#zoomScale){
                    // new zoom scale, need to re-render
                    // saves zoomscale for next zoom call
                    this.#zoomScale = transform.k;
                    this.#renderMap();
                }
            })
        this.#svg.call(this.#zoom)
    }

    // function to render the base map
    #renderMap(){
        this.#projection = d3.geoConicConformal()
            .fitSize([this.#width,this.#height], this.#ukUnits);
        this.#path = d3.geoPath()
            .pointRadius(4/this.#zoomScale)
            .projection(this.#projection);

        this.#mapGroup.selectAll('path.unit')
            .data(this.#ukUnits.features)
            .join('path')
            .classed('unit', true)
            .attr('d', this.#path)
            .style('fill',d=>d.id==='IRL'?'white':'lightgrey');

        this.#mapGroup.selectAll('path.borders')
            .data([this.#ukBorders])
            .join('path')
            .classed('borders', true)
            .attr('d', this.#path)
            .style('stroke-width', 1/this.#zoomScale)
            .style('stroke', 'lightslategrey')
            .style('stroke-dasharray', '1px 1px')
            .style('fill','none');

        this.#mapGroup.selectAll('path.coast')
            .data([this.#ukCoast])
            .join('path')
            .classed('coast', true)
            .attr('d', this.#path)
            .style('stroke-width', 1/this.#zoomScale)
            .style('stroke', 'lightslategrey')
            .style('fill','none');

        this.#mapGroup.selectAll('path.city')
            .data([this.#ukCities])
            .join('path')
            .classed('city', true)
            .attr('d', this.#path)
            .style('fill', 'darkslategrey');

        this.#mapGroup.selectAll('text.city')
            .data(this.#ukCities.features)
            .join('text')
            .classed('city', true)
            .attr('transform', d=>`translate(${this.#projection(d.geometry.coordinates)})`)
            .attr('dy', -8/this.#zoomScale)
            .text(d=>d.properties.name)
            .style('font-size', `${0.7/this.#zoomScale}em`)
            .style('fill', 'darkslategrey')
            .style('text-anchor', 'middle')
            .style('font-family', 'sans-serif');
    }
}

