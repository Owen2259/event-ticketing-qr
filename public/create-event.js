document.getElementById('add-ticket-type').addEventListener('click', function () {
  var container = document.getElementById('ticket-types');
  var row = container.querySelector('.ticket-row').cloneNode(true);
  row.querySelectorAll('input').forEach(function (input) { input.value = ''; });
  container.appendChild(row);
});