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
        var atr =  {};
        atr.dpi = 72.0;
        atr.pos = "0,0";
        atr.width = 0.75;
        atr.height = 0.5;
        atr.fontsize = 14;
        atr.shape = "ellipse";
        atr.color = "black"
        atr.label = "\\N";
        atr.class = undefined;
        atr.id = undefined;
        atr.penwidth = 1;
        atr.fillcolor = "lightgrey";
        atr.style = "solid";
        atr.fontcolor = "black";
        atr.fontname = "Times-Roman";
        return atr;
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

    static ParseAttributes(attr_list, atr)
    {
        attr_list.forEach(element => {
            switch(element.id) {
                case "width":
                    atr.width = parseFloat(element.eq);
                    break;
                case "height":
                    atr.height = parseFloat(element.eq);
                    break;
                default:
                    atr[element.id] = element.eq;
                    break;
            }
        });
        return atr;
    }

    static ParseNode(context, node, nodes)
    {
        //check if the node already exists
        if (nodes.includes(node.node_id.id)) {
            return;
        }
        var defaults = GraphVisualizer.GraphvizDefaults;
        var atr = GraphVisualizer.ParseAttributes(node.attr_list, context.nodeDefaults);
        var group = context.container.group().id(atr.id ? atr.id : GraphVisualizer.GraphPrefix() + node.node_id.id);
        var shape = GraphVisualizer.ParseShape(group, atr);
        shape.addClass('dot-shape');
        if(atr.class) {
            group.addClass(atr.class);
        }
        var pos = GraphVisualizer.ParseNodePosition(atr.pos);
        var style = atr.style || defaults.style;
        switch(style) {
            case "filled": 
                var fillColor = atr.fillcolor || atr.color  || GraphVisualizer.GraphvizDefaults.fillcolor;
                shape.fill(fillColor);
                break;
            case "solid":
                shape.fill("#ffffff");
                break;
        }
        shape.stroke({ width: 1, color: atr.color });
        var text = group.text(atr.label != "\\N" ? atr.label : node.node_id.id);
        var fontSize = atr.fontsize || defaults.fontsize;
        text.font({
            anchor: 'middle',
            size: fontSize,
            family: atr.fontname || defaults.fontname,
            fill: atr.fontcolor || defaults.fontcolor });
        text.attr({ x: pos.X, y: pos.Y - fontSize});
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
        var atr = GraphVisualizer.ParseAttributes(edge.attr_list, context.edgeDefaults);
        var positions = GraphVisualizer.ParsePositionArray(atr.pos);
        var data = GraphVisualizer.ConstructSplines(positions);
        var defaults = GraphVisualizer.GraphvizDefaults;
        var group = context.container.group().id(atr.id ? atr.id : GraphVisualizer.GraphPrefix() + edge.edge_list.map((c, i, a) => { return c.id}).join('-'));
        var path = group.path(data.path);
        if(atr.class) {
            group.addClass(atr.class);
        }
        path.fill('none').stroke({
            width: atr.penwidth || defaults.penwidth,
            linecap: 'round',
            linejoin: 'round',
            color: atr.color || defaults.color,
        }); 
        GraphVisualizer.ParseTip(group, positions[positions.length - 1], positions[0]);
        if (atr.label) {
            var fontSize = atr.fontsize || defaults.fontsize;
            var text = context.container.text(atr.label.toString());
            var pos = atr.lp ? GraphVisualizer.ParseNodePosition(atr.lp) : { x: x0, y: -y1 };
            text.font({
                anchor: 'middle',
                size: fontSize,
                family: atr.fontname || defaults.fontname,
                fill: atr.fontcolor || defaults.fontcolor });
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
    
    static ParseShape (container, atributes)
    {
        var defaults = GraphVisualizer.GraphvizDefaults;
        var width = atributes.width * defaults.dpi;
        var height = atributes.height * defaults.dpi;
        var pos = GraphVisualizer.ParseNodePosition(atributes.pos);
        var shape = atributes.shape || defaults.shape;
        var color = atributes.color || defaults.color;
        switch(shape) {
            case "ellipse":
                return container.ellipse().move(pos.X, pos.Y).radius(width / 2, height / 2);
            case "circle":
                return container.circle().move(pos.X, pos.Y).radius(height / 2);
            case "box":
            case "rect":
            case "rectangle":
                return container.rect(width, height).move(pos.X - width / 2, pos.Y - height / 2);
            case "diamond":
                return container
                    .polygon(`${-width / 2},${0} ${0},${ height / 2} ${width / 2},${0} ${0},${ -height / 2}`)
                    .move(pos.X, pos.Y);
            case "Mdiamond":
                var offset = 5;
                var a = new Victor(pos.X - width / 2, pos.Y);
                var b = new Victor(pos.X, pos.Y + height / 2);
                var c = new Victor(pos.X + width / 2, pos.Y);
                var d = new Victor(pos.X, pos.Y - height / 2);
                var shape = container
                    .polygon(`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`);
                var offsetv = offset * width / height;
                var deltah = width  / 2 * (offset * 2 / height);
                var deltav = height / 2 * (offsetv * 2 / width);
                container.line(a.x + deltah, a.y + offset, a.x + deltah, a.y - offset).stroke({ width: 1, color: color });
                container.line(b.x - offsetv, b.y - deltav, b.x  + offsetv, b.y - deltav).stroke({ width: 1, color: color });
                container.line(c.x - deltah, c.y + offset, c.x - deltah, c.y - offset).stroke({ width: 1, color: color });
                container.line(d.x - offsetv, d.y + deltav, d.x  + offsetv, d.y + deltav).stroke({ width: 1, color: color });
                return shape;
            case "Msquare":
                var offset = 15;
                var a = new Victor(pos.X - width / 2, pos.Y - height / 2);
                var b = new Victor(pos.X + width / 2, pos.Y - height / 2);
                var c = new Victor(pos.X + width / 2, pos.Y + height / 2);
                var d = new Victor(pos.X - width / 2, pos.Y + height / 2);
                var shape =  container.rect(width, height).move(pos.X - width / 2, pos.Y - height / 2);
                var delta = offset / 2;
                container.line(a.x + delta, a.y, a.x, a.y + delta).stroke({ width: 1, color: color });
                container.line(b.x - delta, b.y, b.x, b.y + delta).stroke({ width: 1, color: color });
                container.line(c.x, c.y - delta, c.x - delta, c.y).stroke({ width: 1, color: color });
                container.line(d.x, d.y - delta, d.x + delta, d.y).stroke({ width: 1, color: color });
            return shape;
        }
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
        var atr = context.graphDefaults;
        var bb = GraphVisualizer.ParseRectangle(context.graphDefaults.bb);
        if (element.id && element.id.startsWith("cluster")) {
            var style = atr.style || defaults.style;
            var shape = context.container.rect().attr({
                x: bb.x0,
                y: -bb.y1,
                width: bb.x1 - bb.x0,
                height: bb.y1 - bb.y0
            });
            var fillColor = style == "filled" ? atr.fillcolor || atr.color  || defaults.fillcolor : "white";
            shape.fill(fillColor);
            shape.stroke({ width: 1, color: atr.color || defaults.color });
        }
        if (atr.label) {
            var fontSize = atr.lheight * defaults.dpi || defaults.fontsize;
            var pos = atr.lp ? GraphVisualizer.ParseNodePosition(atr.lp) : { x: bb.x0, y: -bb.y1 };
            var text = context.container.text(atr.label);
            text.font({
                anchor: 'middle',
                size: fontSize,
                family: atr.fontname || defaults.fontname,
                fill: atr.fontcolor || defaults.fontcolor });
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