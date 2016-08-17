var mathSheet = [
    {key:'Tri', value: 1000000000000},
    {key:'Bil', value: 1000000000},
    {key:'Mil', value: 1000000},
    {key:'Thd', value: 1000}
]

function beautifulDigits(input) {
    var value = Number(input);
    for(var i = 0; i < mathSheet.length; i++) {
        if (value > mathSheet[i].value)
            return (value/mathSheet[i].value).toPrecision(3) + ' ' + mathSheet[i].key;
    }
    return value;
}

export {
    beautifulDigits
};