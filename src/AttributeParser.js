module.exports = class AttributeParser {
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
        return text.split(' ').map((v, i, a) => AttributeParser.ParseNodePosition(v));
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
}
