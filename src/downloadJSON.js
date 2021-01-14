// @ts-check
'use strict';

export function downloadJSON(data, name) {
  const fileContent = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const windowURL = window.webkitURL ? window.webkitURL : window.URL;
  var link = document.createElement('a');
  link.download = name;
  link.href = windowURL.createObjectURL(fileContent);
  link.click();
}
