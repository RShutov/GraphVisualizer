var dotparser = require('dotparser');
var SVG = require('svg.js');
var Victor = require('victor');
var Context = require('./Context.js')
var Attributes = require('./Attributes.js')
var AttributeParser = require('./AttributeParser.js')
var Shapes = require('./Shapes.js')

export class GraphVisualizer
{
    static GraphPrefix()
    {
        return "dot-";
    }

    static Svg(id, data)
    {
        var doc = new SVG(id)
        var context = new Context(doc);
        data = GraphVisualizer.RemoveLineEndWrapping(data);
        GraphVisualizer.ParseSubgraph(context, GraphVisualizer.ParseGraph(data)[0], new Array());
        return doc;
    }

    static RemoveLineEndWrapping(text) {
        return text.replace(new RegExp(/\\\r\n/, 'g'), '');
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
        var newContext = context.Copy();
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

    static ParseNode(context, node, nodes)
    {
        //check if the node already exists
        if (nodes.includes(node.node_id.id)) {
            return;
        }
        var defaults = Attributes.Default;
        var attr = context.nodeDefaults.Copy();
        attr.Override(node.attr_list);
        var group = context.container.group().id(attr.id ? attr.id : GraphVisualizer.GraphPrefix() + node.node_id.id);
        var shape = GraphVisualizer.ParseShape(group, attr, node.node_id.id);
        shape.addClass('dot-shape');
        if(attr.class) {
            group.addClass(attr.class);
        }
        var pos = AttributeParser.ParseNodePosition(attr.pos);
        var style = attr.style || defaults.style;
        switch(style) {
            case "filled": 
                var fillColor = attr.fillcolor || attr.color  || Attributes.Default.fillcolor;
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
        var attr = context.edgeDefaults.Copy();
        attr.Override(edge.attr_list);
        var positions = AttributeParser.ParsePositionArray(attr.pos);
        var data = GraphVisualizer.ConstructSplines(positions);
        var defaults = Attributes.Default;
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
            var pos = attr.lp ? AttributeParser.ParseNodePosition(attr.lp) : { x: x0, y: -y1 };
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
        var attributes = new Attributes();
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
        attributes.Override(attribute.attr_list);
        if (context.isRoot && attribute.target == "graph") {
            GraphVisualizer.SetupDocumentBounds(context, attributes);
        }
    }

    static ParseRecord(container, attributes)
    {
        var defaults = Attributes.Default;
        var group = container.group();
        var labels = AttributeParser.ParseRecordLabel(group, attributes.label);
        var i = 0;
        var rects = attributes.rects
            .split(' ')
            .map((v, i ,a) => AttributeParser.ParseRectangle(v))
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
        var defaults = Attributes.Default;
        var shapeAtr = attributes.shape || defaults.shape;
        if (shapeAtr === "record") {
            return GraphVisualizer.ParseRecord(container, attributes);
        } else {
            var pos = AttributeParser.ParseNodePosition(attributes.pos);
            var shape = GraphVisualizer.BuildShape(shapeAtr, container, attributes);
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
    }

    static BuildShape(shape, container, attributes)
    {
        var defaults = Attributes.Default;
        var width = attributes.width * defaults.dpi;
        var height = attributes.height * defaults.dpi;
        var pos = AttributeParser.ParseNodePosition(attributes.pos);
        var color = attributes.color || defaults.color;
        switch(shape) {
            case "oval":
            case "ellipse":
                return Shapes.Ellipse(container, pos, width / 2, height / 2);
            case "circle":
                return Shapes.Circle(container, pos, height / 2);
            case "box":
            case "rect":
            case "rectangle":
                return Shapes.Rectangle(container, pos, width, height);
            case "diamond":
                return Shapes.Diamond(container, pos, width, height);
            case "Mdiamond":
                return Shapes.MDiamond(container, pos, width, height, color)
            case "Msquare":
                return Shapes.Msquare(container, pos, width, height, color);
            default:
                throw `Unknow shape ${ shape }`;
        }
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
        var defaults = Attributes.Default;
        var attr = context.graphDefaults;
        var bb = AttributeParser.ParseRectangle(context.graphDefaults.bb);
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
            var pos = attr.lp ? AttributeParser.ParseNodePosition(attr.lp) : { x: bb.x0, y: -bb.y1 };
            var text = context.container.text(attr.label);
            text.font({
                anchor: 'middle',
                size: fontSize,
                family: attr.fontname || defaults.fontname,
                fill: attr.fontcolor || defaults.fontcolor });
            text.attr({ x: pos.X, y: pos.Y - fontSize});
        }
    }

    static SetupDocumentBounds(context, attributes)
    {
        var offset = 4;
        var bb = AttributeParser.ParseRectangle(context.graphDefaults.bb)
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
                        var bb = AttributeParser.ParseRectangle(element.eq);
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