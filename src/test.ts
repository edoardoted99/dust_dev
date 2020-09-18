// @ts-check

/**
 * Parse an angle and returns an array of fields
 *
 * @param {String} value The string representing the angle
 * @return {[number]} The parsed fields
 * 
 * The accepted format anything like these examples: 
 * –12° 34' 56".789  =>  [-12, -34, -56.789];
 * –12° 34'.567  =>  [-12, -34.567];
 * +12°.3456  =>  [12.3456];
 * 12ʰ 34ᵐ 56ˢ.7  =>  [12, 34, 56.7];
 * 12ʰ 34ᵐ.56  =>  [12, 34.56];
 * 
 * and so on. Notice that negative angles have all fields negative: this helps
 * for the conversion and avoids mistakes for angles such as -0° 0' 12".
 */
function parseAngle2(value: String) {
  let parsedValue = value.replace(/[°'"ʰᵐˢ]/g, '').replace('—', '-').split(' ').map(parseFloat);
  // Fix negative values
  if (value[0] == '–' || value[0] == '-') {
    for (let i = 1; i < parsedValue.length; i++)
      parsedValue[i] = -parsedValue[i];
  }
  return parsedValue;
}


var a = parseAngle2('Marco');
let s = 'asd';
s
