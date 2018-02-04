var dotparser = require('dotparser');
var SVG = require('svg.js');
var Context = require('./Context.js')
var Parser = require('./Parser.js')

export class GraphVisualizer
{
    static Svg(id, data)
    {
        var doc = new SVG(id)
        data = GraphVisualizer.RemoveLineEndWrapping(data);
        Parser.ParseSubgraph(new Context(doc), GraphVisualizer.GetDotFromText(data)[0], new Array());
        return doc;
    }

    static RemoveLineEndWrapping(text) {
        return text.replace(new RegExp(/\\\r\n/, 'g'), '');
    }

    static GetDotFromText(text)
    {
        return dotparser(text);
    }
}