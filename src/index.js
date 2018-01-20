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

    static GraphvizDefaults(){
        //defaults taken from https://www.graphviz.org/doc/info/attrs.html
        var atr =  new Object();
        atr.dpi = 72.0;
        atr.pos = "0,0";
        atr.width = 0.75;
        atr.height = 0.5;
        atr.fontsize = 14;
        atr.shape = "ellipse";
        atr.color = "black"
        atr.label = undefined;
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

    static ParseAttributes(node) {
        var atr = GraphVisualizer.GraphvizDefaults();
        node.attr_list.forEach(element => {
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

    static ParseNode(doc, node, nodes) {
        //check if the node already exists
        if (nodes.includes(node.node_id.id)) {
            return;
        }
        var atr = GraphVisualizer.ParseAttributes(node);
        var group = doc.group().id(GraphVisualizer.GraphPrefix() + node.node_id.id);
        var shape = GraphVisualizer.CreateShape(group, atr);
        shape.addClass('dot-shape');
        var pos = GraphVisualizer.ParseNodePosition(atr.pos);
        switch(atr.style) {
            case "filled":
                shape.fill(atr.fillcolor);
                break;
            case "solid":
                shape.fill("#ffffff");
                break;
            }
        shape.stroke({ width: 1 })
        var text = group.text(atr.label != undefined ? atr.label : node.node_id.id);
        var yOffset = atr.fontsize;
        text.font({
            anchor: 'middle',
            size: atr.fontsize,
            family: atr.fontname,
            fill: atr.fontcolor });
        text.attr({ x: pos.X, y: pos.Y - yOffset});
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

    static ParseEdge(doc, edge) {
        var atr = GraphVisualizer.ParseAttributes(edge);
        var data = GraphVisualizer.ParseEdgePosition(atr.pos);
        var group = doc.group().id(GraphVisualizer.GraphPrefix() + edge.edge_list.map((c, i, a) => { return c.id}).join('-'));
        var path = group.path(data.path);
        path.fill('none').stroke({ width: 1, linecap: 'round', linejoin: 'round' }); 
        GraphVisualizer.AddTip(group, data);
    }

    static ParseGraphAttributes(doc, container, attribute, isRoot) {
        switch(attribute.target) {
            case "graph":
                GraphVisualizer.SetupGraphAttributes(doc, container, attribute.attr_list, isRoot);
            break;
        }
    }

    static SetupGraphAttributes(doc, container,  attributes, isRoot) {
        attributes.forEach(element => {
            switch(element.id) {
                case "bb":
                    if (isRoot) {
                        var bb = element.eq.split(',');
                        var x = parseFloat(bb[2]);
                        var y = parseFloat(bb[3]);
                        doc.size(x, y);
                        container.move(0, y);
                    }
                break;
            }
        });
    }
    
    static CreateShape (container, atributes) {
        var width = atributes.width * atributes.dpi;
        var height = atributes.height * atributes.dpi;
        var pos = GraphVisualizer.ParseNodePosition(atributes.pos);
        switch(atributes.shape) {
            case "ellipse":
                return container.ellipse().move(pos.X, pos.Y).radius(width / 2, height / 2);
            case "circle":
                return container.circle().move(pos.X, pos.Y).radius(height / 2);
            case "box":
            case "rect":
            case "rectangle":
                return container.rect(width, height).move(pos.X - width / 2, pos.Y - height / 2);
        }
    }

    static Svg(id, data) {
        var doc = new SVG(id)
        GraphVisualizer.ParseGraph(doc, doc.group(), GraphVisualizer.parseGraph(data)[0], new Array(), true);
        return doc;
    }

    static ParseGraph(doc, container, element, nodes, isRoot) {
        element.children.forEach(element => {
            switch(element.type) {
                case "node_stmt":
                    GraphVisualizer.ParseNode(container, element, nodes);
                break;
                case "edge_stmt":
                    GraphVisualizer.ParseEdge(container, element);
                break;
                case "attr_stmt" :
                   GraphVisualizer.ParseGraphAttributes(doc, container, element, isRoot);
                break;
                case "subgraph" :
                    GraphVisualizer.ParseGraph(doc, container.group(), element, nodes, false);
                break;
            }
        });
    }
}