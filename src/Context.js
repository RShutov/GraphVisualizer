module.exports = class Context {

    constructor (doc) {
        this.isRoot = true;
        this.doc = doc;
        this.container = doc.group();
        this.nodeDefaults = {};
        this.graphDefaults = {};
        this.edgeDefaults = {};
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

    Copy()
    {
        var newContext = Object.assign(Object.create( Object.getPrototypeOf(this)), this)
        newContext.nodeDefaults = Object.assign({}, this.nodeDefaults);
        newContext.edgeDefaults = Object.assign({}, this.edgeDefaults);
        newContext.graphDefaults = Object.assign({}, this.graphDefaults);
        return newContext;
    }
}