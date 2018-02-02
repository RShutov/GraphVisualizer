module.exports = class Attributes
{
    Override(attr_list)
    {
        attr_list.forEach(element => {
            switch(element.id) {
                case "width":
                    this.width = parseFloat(element.eq);
                    break;
                case "height":
                    this.height = parseFloat(element.eq);
                    break;
                default:
                    this[element.id] = element.eq;
                    break;
            }
        });
    }

    Copy(){
       return Object.assign(Object.create( Object.getPrototypeOf(this)), this);
    }

    static get Default()
    {
        //defaults taken from https://www.graphviz.org/doc/info/attrs.html
        var attr = new Attributes();
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
}
