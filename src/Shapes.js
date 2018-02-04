var Attributes = require('./Attributes.js')
var Victor = require('victor');

module.exports = class Shapes
{
    static Ellipse(container, position, radius1, radius2) {
        return container.ellipse().move(position.X, position.Y).radius(radius1, radius2);
    }

    static Circle(container, position, radius)
    {
        return container.circle().move(position.X, position.Y).radius(radius);
    }

    static Rectangle(container, position, width, height)
    {
        return container.rect(width, height).move(position.X - width / 2, position.Y - height / 2);
    }

    static Diamond(container, position, width, height)
    {
        return container
        .polygon(`${-width / 2},${0} ${0},${ height / 2} ${width / 2},${0} ${0},${ -height / 2}`)
        .move(position.X, position.Y);
    }

    static MDiamond(container, position, width, height, color)
    {
        var offset = 5;
        var a = new Victor(position.X - width / 2, position.Y);
        var b = new Victor(position.X, position.Y + height / 2);
        var c = new Victor(position.X + width / 2, position.Y);
        var d = new Victor(position.X, position.Y - height / 2);
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
    }

    static Msquare(container, position, width, height, color)
    {
        var offset = 15;
        var a = new Victor(position.X - width / 2, position.Y - height / 2);
        var b = new Victor(position.X + width / 2, position.Y - height / 2);
        var c = new Victor(position.X + width / 2, position.Y + height / 2);
        var d = new Victor(position.X - width / 2, position.Y + height / 2);
        var shape =  container.rect(width, height).move(position.X - width / 2, position.Y - height / 2);
        var delta = offset / 2;
        container.line(a.x + delta, a.y, a.x, a.y + delta).stroke({ width: 1, color: color });
        container.line(b.x - delta, b.y, b.x, b.y + delta).stroke({ width: 1, color: color });
        container.line(c.x, c.y - delta, c.x - delta, c.y).stroke({ width: 1, color: color });
        container.line(d.x, d.y - delta, d.x + delta, d.y).stroke({ width: 1, color: color });
        return shape;
    }
}