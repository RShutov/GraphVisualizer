var dotparser = require('dotparser');
var SVG = require('svg.js');
var Victor = require('victor');

export class GraphVisualizer
{
    
    static GraphPrefix()
    {
        return "dot-";
    }

    static get GraphvizDefaults()
    {
        //defaults taken from https://www.graphviz.org/doc/info/attrs.html
        var attr =  {};
        attr.dpi = 72.0;
        attr.pos = "0,0";
        attr.width = 0.75;
        attr.height = 0.5;
        attr.fontsize = 14;
        attr.shape = "ellipse";
        attr.color = "black"
        attr.label = "\\N";
        attr.class = undefined;
        attr.id = undefined;
        attr.penwidth = 1;
        attr.fillcolor = "lightgrey";
        attr.style = "solid";
        attr.fontcolor = "black";
        attr.fontname = "Times-Roman";
        return attr;
    }

    static Svg(id, data)
    {
        var doc = new SVG(id)
        var context = {};
        context.isRoot = true;
        context.doc = doc;
        context.container = doc.group();
        context.nodeDefaults = {};
        context.graphDefaults = {};
        context.edgeDefaults = {};
        GraphVisualizer.ParseSubgraph(context, GraphVisualizer.ParseGraph(data)[0], new Array());
        return doc;
    }

    static ParseGraph(text)
    {
        return dotparser(text);
    }

    static ParseSubgraph(context, element, nodes)
    {
        /*
         * Bug: dotparser creates two instances for single cluster – with 
         * empty children and attributes but with filled id and vice versa
        */
        GraphVisualizer.FixSubgraphs(element);
        var newContext = GraphVisualizer.CopyContext(context);
        element.children.filter(e => e.type == "attr_stmt").forEach(e => GraphVisualizer.ParseGraphAttributes(newContext, e));
        GraphVisualizer.DecorateGraph(element, newContext);
        element.children.filter(e => e.type == "subgraph").forEach(e => {
            newContext.container = context.container.group();
            newContext.isRoot = false;
            GraphVisualizer.ParseSubgraph(newContext, e, nodes);
        });
        element.children.filter(e => e.type == "edge_stmt").forEach(e => GraphVisualizer.ParseEdge(newContext, e));
        element.children.filter(e => e.type == "node_stmt").forEach(e => GraphVisualizer.ParseNode(newContext, e, nodes));
    }

    /*
    * Field 'type' contains information about dot type:
    * 'r' – regular dot
    * 'e' – end point
    * 's' – start point
    */
    static ParseNodePosition(text)
    {
        var pos = {};
        var result = text.split(',');
        pos.type = "r";
        if (result.length == 3) {
            pos.type = result.splice(0, 1)[0];
        }
        pos.X =  parseFloat(result[0]);
        //hack: parseFloat ignore all characters after valid float number, so optional symbol '!' will be ignored
        // invert y position to change default y-axis orientation
        pos.Y = -parseFloat(result[1]);
        return pos;
    }

    static ParsePositionArray(text)
    {
        return text.split(' ').map((v, i, a) => GraphVisualizer.ParseNodePosition(v));
    }

    static ParseRectangle(text)
    {
        var pos = {};
        var result = text.split(',');
        pos.x0 = parseFloat(result[0]);
        pos.y0 = parseFloat(result[1]);
        pos.x1 = parseFloat(result[2]);
        pos.y1 = parseFloat(result[3]);
        return pos;
    }

    static ParseAttributes(attr_list, attr)
    {
        attr_list.forEach(element => {
            switch(element.id) {
                case "width":
                    attr.width = parseFloat(element.eq);
                    break;
                case "height":
                    attr.height = parseFloat(element.eq);
                    break;
                default:
                    attr[element.id] = element.eq;
                    break;
            }
        });
    }

    static ParseNode(context, node, nodes)
    {
        //check if the node already exists
        if (nodes.includes(node.node_id.id)) {
            return;
        }
        var defaults = GraphVisualizer.GraphvizDefaults;
        var attr = Object.assign({}, context.nodeDefaults);
        GraphVisualizer.ParseAttributes(node.attr_list, attr);
        var group = context.container.group().id(attr.id ? attr.id : GraphVisualizer.GraphPrefix() + node.node_id.id);
        var shape = GraphVisualizer.ParseShape(group, attr, node.node_id.id);
        shape.addClass('dot-shape');
        if(attr.class) {
            group.addClass(attr.class);
        }
        var pos = GraphVisualizer.ParseNodePosition(attr.pos);
        var style = attr.style || defaults.style;
        switch(style) {
            case "filled": 
                var fillColor = attr.fillcolor || attr.color  || GraphVisualizer.GraphvizDefaults.fillcolor;
                shape.fill(fillColor);
                break;
            case "solid":
                shape.fill("#ffffff");
                break;
        }
        shape.stroke({ width: 1, color: attr.color });
        group.addClass('dot-node');
        nodes.push(node.node_id.id);
    }

    static ParseTip(doc, start, end)
    {
        if (end.type != 'e') {
            return;
        }
        var tipWidth = 3;
        var start = new Victor(start.X, start.Y);
        var end = new Victor(end.X, end.Y);
        var dir = end.clone().subtract(start).normalize();
        dir = new Victor(-dir.y, dir.x);
        var left = start.clone().add(dir.clone().multiply(new Victor(tipWidth, tipWidth)));
        var right = start.clone().add(dir.clone().multiply(new Victor(-tipWidth, -tipWidth)));
        doc.polygon(`${left.x},${left.y} ${right.x},${right.y} ${end.x},${end.y} ${left.x},${left.y}`);
    }

    static ParseEdge(context, edge)
    {
        var attr = Object.assign({}, context.edgeDefaults)
        GraphVisualizer.ParseAttributes(edge.attr_list, attr);
        var positions = GraphVisualizer.ParsePositionArray(attr.pos);
        var data = GraphVisualizer.ConstructSplines(positions);
        var defaults = GraphVisualizer.GraphvizDefaults;
        var group = context.container.group().id(attr.id ? attr.id : GraphVisualizer.GraphPrefix() + edge.edge_list.map((c, i, a) => { return c.id}).join('-'));
        var path = group.path(data.path);
        if(attr.class) {
            group.addClass(attr.class);
        }
        path.fill('none').stroke({
            width: attr.penwidth || defaults.penwidth,
            linecap: 'round',
            linejoin: 'round',
            color: attr.color || defaults.color,
        }); 
        GraphVisualizer.ParseTip(group, positions[positions.length - 1], positions[0]);
        if (attr.label) {
            var fontSize = attr.fontsize || defaults.fontsize;
            var text = context.container.text(attr.label.toString());
            var pos = attr.lp ? GraphVisualizer.ParseNodePosition(attr.lp) : { x: x0, y: -y1 };
            text.font({
                anchor: 'middle',
                size: fontSize,
                family: attr.fontname || defaults.fontname,
                fill: attr.fontcolor || defaults.fontcolor });
            text.attr({ x: pos.x, y: -pos.y - fontSize});
        }
    }

    static ParseGraphAttributes(context, attribute)
    {
        var attributes = {};
        switch(attribute.target) {
            case "graph":
                attributes = context.graphDefaults;
                break;
            case "node":
                attributes = context.nodeDefaults;
                break;
            case "edge":
                attributes = context.edgeDefaults;
                break;
        }
        GraphVisualizer.ParseAttributes(attribute.attr_list, attributes);
        if (context.isRoot && attribute.target == "graph") {
            GraphVisualizer.SetupDocumentBounds(context, attributes);
        }
    }
    
    static ParseRecordLabel(container, label)
    {
        var labels = label.split('|');
        labels.forEach((v, i, a) => {
            a[i] = a[i].trim();
            if (a[i].startsWith('{')){
                a[i] = a[i].slice(1, a[i].length);
            }
            if (a[i].endsWith('}')) {
                a[i] = a[i].slice(0, a[i].length - 1);
            }
            a[i] = a[i].trim();
            var components = a[i].split(' ');
            a[i] = components[components.length -1];
        });
        return labels;
    }

    static ParseRecord(container, attributes)
    {
        var defaults = GraphVisualizer.GraphvizDefaults;
        var group = container.group();
        var labels = GraphVisualizer.ParseRecordLabel(group, attributes.label);
        var i = 0;
        var rects = attributes.rects
            .split(' ')
            .map((v, i ,a) => GraphVisualizer.ParseRectangle(v))
            .forEach(v => {
                var width = v.x1 - v.x0;
                var height = v.y1 - v.y0;
                group.rect(width, height).move(v.x0, -v.y1);
                var text = container.text(labels[i]);
                var fontSize = attributes.fontsize || defaults.fontsize;
                text.font({
                    anchor: 'middle',
                    size: fontSize,
                    family: attributes.fontname || defaults.fontname,
                    fill: attributes.fontcolor || defaults.fontcolor });
                text.attr({ x: v.x0 + width / 2, y: -v.y1 - fontSize + height / 2});  
                i++;
            });
        return group;
    }


    static ParseShape (container, attributes, id)
    {
        var defaults = GraphVisualizer.GraphvizDefaults;
        var width = attributes.width * defaults.dpi;
        var height = attributes.height * defaults.dpi;
        var pos = GraphVisualizer.ParseNodePosition(attributes.pos);
        var color = attributes.color || defaults.color;
        var shape = {};
        switch(attributes.shape || defaults.shape) {
            case "record":
                return GraphVisualizer.ParseRecord(container, attributes); 
            case "oval":
            case "ellipse":
                shape = container.ellipse().move(pos.X, pos.Y).radius(width / 2, height / 2);
                break;
            case "circle":
                shape = container.circle().move(pos.X, pos.Y).radius(height / 2);
                break;
            case "box":
            case "rect":
            case "rectangle":
                shape = container.rect(width, height).move(pos.X - width / 2, pos.Y - height / 2);
                break;
            case "diamond":
                shape = container
                    .polygon(`${-width / 2},${0} ${0},${ height / 2} ${width / 2},${0} ${0},${ -height / 2}`)
                    .move(pos.X, pos.Y);
                break;
            case "Mdiamond":
                var offset = 5;
                var a = new Victor(pos.X - width / 2, pos.Y);
                var b = new Victor(pos.X, pos.Y + height / 2);
                var c = new Victor(pos.X + width / 2, pos.Y);
                var d = new Victor(pos.X, pos.Y - height / 2);
                shape = container
                    .polygon(`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`);
                var offsetv = offset * width / height;
                var deltah = width  / 2 * (offset * 2 / height);
                var deltav = height / 2 * (offsetv * 2 / width);
                container.line(a.x + deltah, a.y + offset, a.x + deltah, a.y - offset).stroke({ width: 1, color: color });
                container.line(b.x - offsetv, b.y - deltav, b.x  + offsetv, b.y - deltav).stroke({ width: 1, color: color });
                container.line(c.x - deltah, c.y + offset, c.x - deltah, c.y - offset).stroke({ width: 1, color: color });
                container.line(d.x - offsetv, d.y + deltav, d.x  + offsetv, d.y + deltav).stroke({ width: 1, color: color });
                break;
            case "Msquare":
                var offset = 15;
                var a = new Victor(pos.X - width / 2, pos.Y - height / 2);
                var b = new Victor(pos.X + width / 2, pos.Y - height / 2);
                var c = new Victor(pos.X + width / 2, pos.Y + height / 2);
                var d = new Victor(pos.X - width / 2, pos.Y + height / 2);
                shape =  container.rect(width, height).move(pos.X - width / 2, pos.Y - height / 2);
                var delta = offset / 2;
                container.line(a.x + delta, a.y, a.x, a.y + delta).stroke({ width: 1, color: color });
                container.line(b.x - delta, b.y, b.x, b.y + delta).stroke({ width: 1, color: color });
                container.line(c.x, c.y - delta, c.x - delta, c.y).stroke({ width: 1, color: color });
                container.line(d.x, d.y - delta, d.x + delta, d.y).stroke({ width: 1, color: color });
                break;
        }
        var text = container.text(attributes.label != defaults.label ? attributes.label : id);
        var fontSize = attributes.fontsize || defaults.fontsize;
        text.font({
            anchor: 'middle',
            size: fontSize,
            family: attributes.fontname || defaults.fontname,
            fill: attributes.fontcolor || defaults.fontcolor });
        text.attr({ x: pos.X, y: pos.Y - fontSize});
        return shape;
    }

    static CopyContext(context)
    {
        var newContext = Object.assign({}, context);
        newContext.nodeDefaults = Object.assign({}, context.nodeDefaults);
        newContext.edgeDefaults = Object.assign({}, context.edgeDefaults);
        newContext.graphDefaults = Object.assign({}, context.graphDefaults);
        return newContext;
    }

    static FixSubgraphs(element)
    {
        for(var i = 0; i < element.children.length; i++) {
            if (element.children[i].type == "subgraph") {
                element.children[i + 1].id = element.children[i].id;
                element.children.splice(i, 1);
            }
        }
    }

    static DecorateGraph(element, context)
    {
        var defaults = GraphVisualizer.GraphvizDefaults;
        var attr = context.graphDefaults;
        var bb = GraphVisualizer.ParseRectangle(context.graphDefaults.bb);
        if (element.id && element.id.startsWith("cluster")) {
            var style = attr.style || defaults.style;
            var shape = context.container.rect().attr({
                x: bb.x0,
                y: -bb.y1,
                width: bb.x1 - bb.x0,
                height: bb.y1 - bb.y0
            });
            var fillColor = style == "filled" ? attr.fillcolor || attr.color  || defaults.fillcolor : "white";
            shape.fill(fillColor);
            shape.stroke({ width: 1, color: attr.color || defaults.color });
        }
        if (attr.label) {
            var fontSize = attr.lheight * defaults.dpi || defaults.fontsize;
            var pos = attr.lp ? GraphVisualizer.ParseNodePosition(attr.lp) : { x: bb.x0, y: -bb.y1 };
            var text = context.container.text(attr.label);
            text.font({
                anchor: 'middle',
                size: fontSize,
                family: attr.fontname || defaults.fontname,
                fill: attr.fontcolor || defaults.fontcolor });
            text.attr({ x: pos.x, y: -pos.y - fontSize});
        }
    }

    static SetupDocumentBounds(context, attributes)
    {
        var offset = 4;
        var bb = GraphVisualizer.ParseRectangle(context.graphDefaults.bb)
        context.doc.size(bb.x1 + offset, bb.y1 + offset);
        context.container.move(offset / 2, bb.y1 + offset / 2);
    }
    
    static SetupNodeAttributes(context, attributes)
    {
        var offset = 4;
        attributes.forEach(element => {
            switch(element.id) {
                case "bb":
                    if (context.isRoot) {
                        var bb = GraphVisualizer.ParseRectangle(element.eq);
                        context.doc.size(bb.x1 + offset, bb.y1 + offset);
                        context.container.move(offset / 2, bb.y1 + offset / 2);
                    }
                break;
            }
        });
    }

    static ConstructSplines(positions)
    {
        var data = {};
        //move to the first position
        var str = "M";
        var type = "default";
        for(var i = 0; i < positions.length; i++) {
            if (i == 0 && positions[i].type == 'e') {
                //contains endpoint
                type = "directional";
                data.markerEnd = positions[i].X.toString() +',' + positions[i].Y.toString();
            } else {
                var val = positions[i].X.toString() +',' + positions[i].Y.toString() + ' ';
                if (i == 2 && type == "directional" || i == 1 && type == "default") {
                    //add spline component
                    str += 'C ';
                }
                data.markerStart = val;
                str += data.markerStart;
            }
        }
        data.path = str;
        return data;
    }
}