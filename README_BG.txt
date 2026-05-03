Zoology Field App — Turilik, версия 2

Промени във версия 2:
- Коригиран мобилен интерфейс: полетата са с 16 px шрифт, за да не предизвикват автоматично зуумване при въвеждане на телефон.
- Добавен отделен таб „100 точки“ за въвеждане на point-intercept покривка по стандартния протокол.
- Категориите на покривката автоматично попълват броя точки в обобщената секция „Хабитат“.
- Добавен експорт на координати като GeoJSON и KML, освен CSV/JSON.
- Добавен бутон за копиране на текущите координати.
- Подобрени GPS съобщения и настройки за висока точност.

Качване в GitHub Pages:
1. Разархивирай ZIP файла.
2. В GitHub repository изтрий старите app.js, index.html, manifest.webmanifest и service-worker.js или ги замени.
3. Качи файловете от тази папка в root на repository-то:
   index.html
   app.js
   manifest.webmanifest
   service-worker.js
   icons/
   README_BG.txt
4. Commit changes.
5. Изчакай GitHub Pages deployment да стане зелен.
6. На телефона отвори страницата в Chrome и избери Install app / Add to Home screen.

Важно:
- Данните се пазят локално на устройството. Експортирай редовно CSV или JSON.
- GeoJSON и KML включват само записи с попълнени latitude и longitude.
