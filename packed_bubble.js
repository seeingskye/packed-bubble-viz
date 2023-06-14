const handleErrors = (vis, res, options) => {
    // TODO: Validate measure types & allow for either multi dimension or multi measure
  
    const check = (group, noun, count, min, max) => {
      if (!vis.addError || !vis.clearErrors) return false
      if (count < min) {
        vis.addError({
          title: `Not Enough ${noun}s`,
          message: `This visualization requires ${min === max ? 'exactly' : 'at least'} ${min} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
          group
        })
        return false
      }
      if (count > max) {
        vis.addError({
          title: `Too Many ${noun}s`,
          message: `This visualization requires ${min === max ? 'exactly' : 'no more than'} ${max} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
          group
        })
        return false
      }
      vis.clearErrors(group)
      return true
    }
  
    const { pivots, dimensions, measure_like: measures } = res.fields
  
    return (check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots)
     && check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions)
     && check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures))
  }
  
  const visObject = {
    /**
     * Configuration options
     **/
     options: {
        bubble_colors: {
            section: 'Gauge',
            order: 1,
            label: 'Bubble Gradient',
            type: 'array',
            display: 'colors',
            default: ["#D82C59", "#963CBD", "#100695", "#00C1D5"]
        },
        first_measure_text: {
            order: 2,
            label: 'First Measure Text',
            type: 'string',
            default: "Change"
        },
        second_measure_text: {
            order: 2,
            label: 'Second Measure Text',
            type: 'string',
            default: "Change"
        }
     },
    
    /**
     * The create function gets called when the visualization is mounted but before any
     * data is passed to it.
     **/
       create: function(element, config){
         this.svg = d3.select(element).append('svg');
       },
   
    /**
     * UpdateAsync is the function that gets called (potentially) multiple times. It receives
     * the data and should update the visualization with the new data.
     **/
      updateAsync: function(data, element, config, queryResponse, details, doneRendering){
        console.log(data, queryResponse, details)
        
        this.clearErrors();
        if (!handleErrors(this, queryResponse, {
           min_pivots: 0, max_pivots: 0,
           min_dimensions: 1, max_dimensions: 1,
           min_measures: 1, max_measures: 2
        })) return
    
        // CONFIGS
        const getConfigValue = (configName) => {
          const value = (config && config[configName] != undefined) ? config[configName] : this.options[configName]['default'];
          return value
        }
        const bubbleColor = d3.interpolateRgbBasis(getConfigValue('bubble_colors'));

        // SVG
        const margin = { y: 10, x: 10};
  
        const svg = this.svg
          .html('')
          .attr('x', 0)
          .attr('y', 0)
  
        const vizNode = svg.append('g');
        const gNode = vizNode.append("g");
        const defs = svg.append("defs");
     
   
        // ****************** nodes section ***************************
        const dimension_name = queryResponse.fields.dimension_like[0].name;
        const measures = queryResponse.fields.measure_like.map(measure => measure.name);

        const size_measure = measure_names[0];
        const color_measure = measure_names[1];

        let root = {children: data}; 
        flatNodeHeirarchy = d3.hierarchy(root).sum(d => d[size_measure].value);

        const pack = d3.pack()
            .size([element.clientWidth, element.clientHeight])
            .padding(3)
        const packedData = pack(flatNodeHeirarchy);

        const node = gNode.selectAll("g")
          .data(packedData.leaves());
       
        const nodeEnter = node.enter().append('g')
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`);
        
        nodeEnter.append("circle")
            .attr('r', d => d.r)
            .attr('fill', d => "#bbccff")

         // ****************** viz viewbox section ***************************

         const vizNodeRect = vizNode.node().getBBox();
         const viewBox = {
           'x': vizNodeRect.x - margin.x,
           'y': vizNodeRect.y - margin.y,
           'width': vizNodeRect.width + margin.x*2,
           'height': vizNodeRect.height + margin.y*2
         };
         svg
           .attr('width', element.clientWidth)
           .attr('height', element.clientHeight)
           .attr('viewBox', `${viewBox.x}, ${viewBox.y}, ${viewBox.width}, ${viewBox.height}`)
           .attr('preserveAspectRatio', "xMidYMid meet")

           doneRendering();
       }
   };
   
   looker.plugins.visualizations.add(visObject);