// const handleErrors = (vis, res, options) => {
//     // TODO: Validate measure types & allow for either multi dimension or multi measure
  
//     const check = (group, noun, count, min, max) => {
//       if (!vis.addError || !vis.clearErrors) return false
//       if (count < min) {
//         vis.addError({
//           title: `Not Enough ${noun}s`,
//           message: `This visualization requires ${min === max ? 'exactly' : 'at least'} ${min} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
//           group
//         })
//         return false
//       }
//       if (count > max) {
//         vis.addError({
//           title: `Too Many ${noun}s`,
//           message: `This visualization requires ${min === max ? 'exactly' : 'no more than'} ${max} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
//           group
//         })
//         return false
//       }
//       vis.clearErrors(group)
//       return true
//     }
  
//     const { pivots, dimensions, measure_like: measures } = res.fields
  
//     return (check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots)
//      && check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions)
//      && check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures))
//   }

function formatType(valueFormat) {
  if (typeof valueFormat != "string") {
    return function (x) {return x}
  }
  let format = ""
  switch (valueFormat.charAt(0)) {
    case '$':
      format += '$'; break
    case '£':
      format += '£'; break
    case '€':
      format += '€'; break
  }
  if (valueFormat.indexOf(',') > -1) {
    format += ','
  }
  splitValueFormat = valueFormat.split(".")
  format += '.'
  format += splitValueFormat.length > 1 ? splitValueFormat[1].length : 0

  switch(valueFormat.slice(-1)) {
    case '%':
      format += '%'; break
    case '0':
      format += 'f'; break
  }
  return d3.format(format)
}
        
const addTextBox = (selection, width, text, textAlign = "left", verticalAlign = "top") => {
  // Set initial max bounding width for foreignObject
  const foreignObject = selection.append('foreignObject')
  foreignObject.attr("width", width);
  let div = foreignObject.append('xhtml:div')
  let span = div.append('xhtml:span')
    .style('display', "inline-block")
  span.html(text)
  let {width: divWidth, height: divHeight} = span.node().getBoundingClientRect();
  const ctm = foreignObject.node().getCTM().inverse();
  
  divWidth = divWidth * ctm.a;
  divHeight = divHeight * ctm.d;
  // Set foreignObject to new minimum width
  foreignObject
    .attr("width", divWidth);
  

  if (textAlign === "center") {
    div.style('text-align', "center");
    foreignObject.attr('x', -divWidth /2);
  }
  
  if (verticalAlign === "middle") {
    foreignObject.attr('y', -divHeight / 2)
  }
  
  foreignObject.attr("height", divHeight);

  return {width: divWidth, height: divHeight};
}

const formatFields = (responseObj) => {
  // Create obj to lookup field details by name
  const rawFields = responseObj.fields;
  const combinedFields = rawFields.dimension_like.concat(rawFields.measure_like);
  const fieldsArray = combinedFields.map((field) => [field.name, field]);
  const fields = Object.fromEntries(fieldsArray);

  return fields
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
        color_measure: {
            order: 2,
            label: 'Color Measure',
            type: 'string',
            display: 'select',
            default: "test",
            values: [
              {"test": "test"},
              {"test2": "test2"}
            ]
        },
        size_measure: {
            order: 3,
            label: 'Size Measure',
            type: 'string',
            display: 'select',
            default: "test",
            values: [
              {"test": "test"},
              {"test2": "test2"}
            ]
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
        
        this.clearErrors();
        if (!handleErrors(this, queryResponse, {
           min_pivots: 0, max_pivots: 0,
           min_dimensions: 1, max_dimensions: 1,
           min_measures: 1, max_measures: 2
        })) return

        const fields = formatFields(queryResponse);
    
        // ****************** CONFIGS ***************************
        const dimension_name = queryResponse.fields.dimension_like[0].name;
        const measures = queryResponse.fields.measure_like.map(measure => measure.name);

        const measureOptions = measures.map((measure) => Object.fromEntries([[`${fields[measure].label_short}`, `${measure}`]]));

        this.options.color_measure = {
          order: 2,
          label: 'Color Measure',
          type: 'string',
          display: 'select',
          default: measures[0],
          values: measureOptions
        }
        this.options.size_measure = {
          order: 3,
          label: 'Size Measure',
          type: 'string',
          display: 'select',
          default: measures[1],
          values: measureOptions
        }
        
        this.trigger('registerOptions', this.options)

        const getConfigValue = (configName) => {
          const value = (config && config[configName] != undefined) ? config[configName] : this.options[configName]['default'];
          return value
        }
        const configColors = getConfigValue('bubble_colors');
        const bubbleColor = d3.interpolateRgbBasis(configColors);
        const size_measure = getConfigValue('size_measure');
        const color_measure = getConfigValue('color_measure');

        // SVG
        const margin = { y: 10, x: 10};
  
        const svg = this.svg
          .html('')
          .attr('x', 0)
          .attr('y', 0)
          .style('font-family', "Open Sans, Helvetica, Arial, sans-serif")
  
        const vizNode = svg.append('g');
        const gNode = vizNode.append("g");
        const defs = svg.append("defs");

        const vizGradient = defs.append("linearGradient")
          .attr("id", "vizGradient")
          .attr('gradientTransform', "rotate(90)")

          const colorCount = configColors.length - 1;
          getConfigValue('bubble_colors').reverse().forEach((color, i) => {
            vizGradient.append('stop')
              .attr('offset', `${100 * (i / colorCount)}%`)
              .attr('stop-color', `${color}`)
          })
        
        
        // ****************** tooltip section ***************************
        const tooltip = svg.append('g')
          .style("visibility", "hidden")
          .style("line-height", "1.2em")
          .style("font-size", ".9em");
        
        const tooltipMargin = 5;
        tooltip.append('rect')
          .attr('x', -tooltipMargin)
          .attr('y', -tooltipMargin)
          .attr('rx', 5)
          .attr('ry', 5)
          .style('fill', "hsl(0 0% 95% / .97)")
          // .style('stroke', "black")
          // .style('stroke-width', 1)
          .style('opacity', .97)

        const mouseOverTooltip = function(event, d) {
          d3.select(this).select('circle')
            .style('filter', "drop-shadow(-2px 2px 0.2rem grey)")
          
          tooltip
            .style('visibility', "visible")
            .selectAll('foreignObject').remove();
          const text = `<legend>${LookerCharts.Utils.textForCell(d.data[dimension_name])}</legend>
            <dl><dt style="font-size:.9em">${fields[color_measure].label_short}<b></b></dt>
            <dd><b>${LookerCharts.Utils.textForCell(d.data[color_measure])}</b></dd>
            <dt style="font-size:.9em">${fields[size_measure].label_short}</dt>
            <dd><b>${LookerCharts.Utils.textForCell(d.data[size_measure])}</b></dd></dl>`;
          const {width: width, height: height} = addTextBox(tooltip, 300, text, "left", "top");

          tooltip.select('rect')
          .attr('width', width + tooltipMargin*2)
          .attr('height', height + tooltipMargin*2)

        }

        const mouseMoveTooltip = (event) => {
          let {clientX, clientY} = event;
          const ctm = svg.node().getScreenCTM().inverse();
        
          clientX = (clientX + ctm.e) * ctm.a;
          clientY = (clientY + ctm.f) * ctm.d;
          const tooltipHeight = tooltip.node().getBBox().height;
          tooltip
            .attr('transform', `translate(${clientX + 20}, ${clientY - tooltipHeight/2})`);
        }

        const mouseOutTooltip = function() {
          d3.select(this).select('circle')
            .style('filter', "")
          
          tooltip.style('visibility', "hidden")
        }
     
        // ****************** nodes section ***************************
        const color_measure_values = data.map(row => row[color_measure].value);
        const color_measure_min = Math.min(...color_measure_values);
        const color_measure_max = Math.max(...color_measure_values);
        const color_measure_range = color_measure_max - color_measure_min;

        data.forEach((row) => {
            if (color_measure_range === 0) {  // If all values are the same
                row.color = bubbleColor(.5)
            } else {
                row.color = bubbleColor((row[color_measure].value - color_measure_min) / color_measure_range)
            }
        })

        let root = {children: data}; 
        const flat_node_heirarchy = d3.hierarchy(root)
          .sum(d => Object.hasOwn(d, size_measure) ? d[size_measure].value : 0)
          .sort((a, b) => b.value - a.value);

        const pack = d3.pack()
            .size([element.clientWidth, element.clientHeight])
            .padding(3)
        const packed_data = pack(flat_node_heirarchy);

        const node = gNode.selectAll("g")
          .data(packed_data.leaves());
       
        const node_enter = node.enter().append('g')
            .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
            .on('mouseover', mouseOverTooltip)
            .on('mousemove', mouseMoveTooltip)
            .on('mouseout', mouseOutTooltip);
        
            node_enter.append("circle")
            .attr('r', d => d.r)
            .attr('fill', d => d.data.color)

            node_enter.each(function(d) {
              const width = d.r * 2;
              const text = LookerCharts.Utils.htmlForCell(d.data[dimension_name]);
              d3.select(this).call(addTextBox, width, text, "center", "middle");
            })
        
        
        // ****************** legend section ***************************
        const legend_bar_width = 30;
        const legend_bar_height = element.clientHeight *.75;
        const legendX = (element.clientWidth ) - (legend_bar_width );
        const legendY = (element.clientHeight - legend_bar_height + 20) / 2;

        const colorLegend = vizNode.append("g")
          .attr('transform', `translate(${legendX}, ${legendY})`)
        
        colorLegend.append("rect")
          .attr('x', (legend_bar_width * .2) - legend_bar_width/2)
          .attr('width', legend_bar_width * .7)
          .attr('height', legend_bar_height)
          // .style('stroke', "black")
          .style('fill', "url(#vizGradient)")

        colorLegend.append("text")
          .text(fields[color_measure].label_short)
          .style('text-anchor', "middle")
          .attr('y', -20)
        
        colorLegend.append("path")
          .attr('d', 
            `m${-legend_bar_width/2},0
            l${legend_bar_width},0
            m-${legend_bar_width},${legend_bar_height/4}
            l${legend_bar_width/4},0
            m-${legend_bar_width/4},${legend_bar_height/4}
            l${legend_bar_width/4},0
            m-${legend_bar_width/4},${legend_bar_height/4}
            l${legend_bar_width/4},0
            m-${legend_bar_width/4},${legend_bar_height/4}
            l${legend_bar_width},0`)
          .attr('stroke', "black")
          .attr('stroke-width', 2)
        
        const colorMeasureFormat = formatType(fields[color_measure].value_format);
        
        for (let i = 0; i < 5; i++) {
          const pipValue = color_measure_min + ((color_measure_range / 4) * i);

          colorLegend.append("text")
          .text(colorMeasureFormat ? d3.format(colorMeasureFormat)(pipValue) : pipValue) 
          .attr('x', -3 - legend_bar_width/2)
          .attr('y', legend_bar_height - ((legend_bar_height / 4) * i))
          .style('text-anchor', "end")
          .style('dominant-baseline', "middle")
          .style('font-size', ".8em")
        }

        const sizeLegend = vizNode.append('g')
          .attr('transform', `translate(${legendX}, ${element.clientHeight})`)
          .call(addTextBox, 200, `<b>Size:</b> <br> ${fields[size_measure].label_short}`, "center", "middle")

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