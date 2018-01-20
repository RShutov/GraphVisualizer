var dotparser = require('dotparser');
var SVG = require('svg.js');
var Victor = require('victor');

export class GraphVisualizer {
    
    static parseGraph(text){
        return dotparser(text);
    }

    static GraphPrefix() {
        return "dot-";
    }

    static get GraphvizDefaults(){
        //defaults taken from https://www.graphviz.org/doc/info/attrs.html
        var atr =  new Object();
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
        atr.fillcolor = "lightgrey";
        atr.style = "solid";
        atr.fontcolor = "black";
        atr.fontname = "Times-Roman";
        return atr;
    }

    static ParseNodePosition(text){
        var pos = new Object();
        var result = text.split(',');
        pos.X =  parseFloat(result[0]);
        //hack: parseFloat ignore all characters after valid float number, so optional symbol '!' will be ignored
        // invert y position to change default y-axis orientation
        pos.Y = -parseFloat(result[1]);
        return pos;
    }

    static ParseEdgePosition(text){
        var data = new Object();
        //move to the first position
        var str = "M";
        var positions = text.split(' ');
        var type = "default";
        for(var i = 0; i < positions.length; i++) {
            var components = positions[i].split(',');
            if (components[0] == 'e') {
                //contains endpoint
                type = "directional";
                components.splice(0, 1);
                data.markerEnd = components[0] +',-' + components[1];
            } else {
                var val = components[0] +',-' + components[1] + ' ';
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

    static ParseAttributes(attr_list, atr) {
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

    static ParseNode(context, node, nodes) {
        //check if the node already exists
        if (nodes.includes(node.node_id.id)) {
            return;
        }
        var defaults = GraphVisualizer.GraphvizDefaults;
        var atr = GraphVisualizer.ParseAttributes(node.attr_list, context.nodeDefaults);
        var group = context.container.group().id(atr.id != undefined? atr.id : GraphVisualizer.GraphPrefix() + node.node_id.id);
        var shape = GraphVisualizer.CreateShape(group, atr);
        shape.addClass('dot-shape');
        if(atr.class != undefined) {
            group.addClass(atr.class);
        }
        var pos = GraphVisualizer.ParseNodePosition(atr.pos);
        switch(atr.style) {
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

    static AddTip(doc, data) {
        if (data.markerEnd == undefined) {
            return;
        }
        var tipWidth = 3;
        var pos = data.markerStart.trim().split(',');
        var start = new Victor(parseFloat(pos[0]), parseFloat(pos[1]));
        pos = data.markerEnd.trim().split(',');
        var end = new Victor(parseFloat(pos[0]), parseFloat(pos[1]));
        var dir = end.clone().subtract(start).normalize();
        dir = new Victor(-dir.y, dir.x);
        var left = start.clone().add(dir.clone().multiply(new Victor(tipWidth, tipWidth)));
        var right = start.clone().add(dir.clone().multiply(new Victor(-tipWidth, -tipWidth)));
        doc.polygon(`${left.x},${left.y} ${right.x},${right.y} ${end.x},${end.y} ${left.x},${left.y}`);
    }

    static ParseEdge(context, edge) {
        var atr = GraphVisualizer.ParseAttributes(edge.attr_list, context.edgeDefaults);
        var data = GraphVisualizer.ParseEdgePosition(atr.pos);
        var group = context.container.group().id(atr.id != undefined ? atr.id : GraphVisualizer.GraphPrefix() + edge.edge_list.map((c, i, a) => { return c.id}).join('-'));
        var path = group.path(data.path);
        if(atr.class != undefined) {
            group.addClass(atr.class);
        }
        path.fill('none').stroke({ width: 1, linecap: 'round', linejoin: 'round' }); 
        GraphVisualizer.AddTip(group, data);
    }

    static ParseGraphAttributes(context, attribute) {
        var attributes = new Object();
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

    static SetupDocumentBounds(context, attributes) {
        var offset = 4;
        var bb = context.graphDefaults.bb.split(',');
        var x = parseFloat(bb[2]);
        var y = parseFloat(bb[3]);
        context.doc.size(x + offset, y + offset);
        context.container.move(offset / 2, y + offset / 2);
    }

    
    static SetupNodeAttributes(context, attributes) {
        var offset = 4;
        attributes.forEach(element => {
            switch(element.id) {
                case "bb":
                    if (context.isRoot) {
                        var bb = element.eq.split(',');
                        var x = parseFloat(bb[2]);
                        var y = parseFloat(bb[3]);
                        context.doc.size(x + offset, y + offset);
                        context.container.move(offset / 2, y + offset / 2);
                    }
                break;
            }
        });
    }
    
    static CreateShape (container, atributes) {
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

    static Svg(id, data) {
        var doc = new SVG(id)
        var context = new Object();
        context.isRoot = true;
        context.doc = doc;
        context.container = doc.group();
        context.nodeDefaults = new Object();
        context.graphDefaults = new Object();
        context.edgeDefaults = new Object();
        GraphVisualizer.ParseGraph(context, GraphVisualizer.parseGraph(data)[0], new Array());
        return doc;
    }

    static CopyContext(context) {
        var newContext = Object.assign({}, context);
        newContext.nodeDefaults = Object.assign({}, context.nodeDefaults);
        newContext.edgeDefaults = Object.assign({}, context.edgeDefaults);
        newContext.graphDefaults = Object.assign({}, context.graphDefaults);
        return newContext;
    }

    static FixSubgraphs(element) {
        for(var i = 0; i < element.children.length; i++) {
            if (element.children[i].type == "subgraph") {
                element.children[i + 1].id = element.children[i].id;
                element.children.splice(i, 1);
            }
        }
    }

    static ParseGraph(context, element, nodes) {
        /*
         * Bug: dotparser creates two instances for single cluster – with 
         * empty children and attributes but with filled id and vice versa
        */
        GraphVisualizer.FixSubgraphs(element);
        var newContext = GraphVisualizer.CopyContext(context);
        var defaults = GraphVisualizer.GraphvizDefaults;
        element.children.forEach(element => {
            if (element.type == "attr_stmt") {
                GraphVisualizer.ParseGraphAttributes(newContext, element);
            }
        });
        if (element.id != undefined && element.id.startsWith("cluster")) {
            var atr = newContext.graphDefaults;
            var style = atr.style || defaults.style;
            var bb = newContext.graphDefaults.bb.split(',');
            var x0 = parseFloat(bb[0]);
            var y0 = parseFloat(bb[1]);
            var x1 = parseFloat(bb[2]);
            var y1 = parseFloat(bb[3]);
            var shape = newContext.container.rect().attr({
                x: x0,
                y: -y1,
                width: x1 - x0,
                height: y1 - y0
            });
            var fillColor = style == "filled" ? atr.fillcolor || atr.color  || defaults.fillcolor : "white";
            shape.fill(fillColor);
            shape.stroke({ width: 1, color: atr.color || defaults.color });
        }
        element.children.forEach(element => {
            switch(element.type) {
                case "node_stmt":
                    GraphVisualizer.ParseNode(newContext, element, nodes);
                    break;
                case "edge_stmt":
                    GraphVisualizer.ParseEdge(newContext, element);
                    break;
                case "subgraph" :
                    newContext.container = context.container.group();
                    newContext.isRoot = false;
                    GraphVisualizer.ParseGraph(newContext, element, nodes);
                    break;
            }
        });
    }
}