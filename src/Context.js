var Attributes = require('./Attributes.js')

module.exports = class Context
{
    constructor (doc) {
        this.isRoot = true;
        this.doc = doc;
        this.container = doc.group();
        this.nodeDefaults = new Attributes();
        this.graphDefaults = new Attributes();
        this.edgeDefaults = new Attributes();
    }

    Copy()
    {
        var newContext = Object.assign(Object.create( Object.getPrototypeOf(this)), this)
        newContext.nodeDefaults = this.nodeDefaults.Copy();
        newContext.edgeDefaults = this.edgeDefaults.Copy();
        newContext.graphDefaults = this.graphDefaults.Copy();
        return newContext;
    }
}