# Guion del pitch — 10 minutos, dos presentadores

Acompaña a `MiniRed_Pitch.pptx`. Lo exponen dos alumnos. El reparto no es
arbitrario: **A** lleva el hilo del problema y de las conclusiones, y **B** la
parte técnica (el modelo, las reglas, la validación y la demo). Así se escuchan
dos registros distintos y ninguno habla más de dos minutos seguidos.

El caso plantea que el equipo actúe como una consultora analítica. Eso se
menciona una vez, como parte del enunciado, y de ahí en más se habla en primera
persona como lo que somos: dos alumnos mostrando lo que hicieron.

Los tiempos son de referencia. Lo escrito es para ensayar, no para leer: una vez
que lo tengan por la idea, contarlo con sus palabras suena mucho mejor.

---

## Antes de empezar

- [ ] El portal **abierto en otra ventana**, ya filtrado en "Todas las zonas"
- [ ] SQL Server levantado, por si piden ver una consulta
- [ ] La presentación en modo presentador, para leer las notas de cada lámina
- [ ] Alguien cronometrando: a los 8 minutos hay que estar en la demo
- [ ] Acordar quién dice cada nombre en la presentación inicial

---

## 1 · Portada — **A** — 0:00 a 0:30

>  Buenas tardes. Somos [nombre] y [nombre], y venimos a presentar el trabajo
> práctico de la Unidad 3.
>
> El caso es MiniRed, una cadena de seis minimercados con un depósito central. El
> enunciado nos pide ponernos en el lugar de una consultora y resolver un desafío
> de abastecimiento sobre dos años de datos.
>
> Elegimos la perspectiva de logística e inventario, así que la pregunta que
> tratamos de responder fue: **dónde está perdiendo plata MiniRed con el stock**.
>
> En los próximos diez minutos les contamos qué encontramos, cómo nos aseguramos
> de que fuera cierto, y a qué decisiones lleva.

**Transición:** *"Arranquemos por el problema, que tiene dos caras."*

---

## 2 · Dos formas de perder plata — **A** — 0:30 a 1:20

> Cuando uno piensa en un problema de stock, piensa en la góndola vacía. El
> cliente va a buscar el producto, no lo encuentra, y se va. Eso es venta
> perdida, y encima se lleva al cliente al competidor de la esquina.
>
> Es el primero de los dos problemas que fuimos a buscar.
>
> En MiniRed eso pasa el **5,22%** de las veces. De cada cien días que un producto
> estuvo a la venta, en cinco no estaba.
>
> Pero hay un segundo problema, que es el opuesto y casi nadie lo mira: el
> depósito lleno. Mercadería que nadie compró. Son **doce millones de pesos**
> parados en góndola, que además ocupan lugar y pueden vencerse.
>
> Y acá está lo importante: **corregir mal uno empeora el otro**. Si la respuesta
> a los faltantes es "mandemos más mercadería", se termina con el segundo
> problema. Por eso hay que mirar los dos juntos.

**Transición:** *"Para poder mirarlos, primero hubo que construir de dónde mirarlos."*

---

## 3 · Punto de partida — **A** — 1:20 a 2:00

> Un detalle de método, porque seguramente lo van a preguntar: la cátedra define
> el diseño del caso, pero no entrega la base cargada. La construimos nosotros.
>
> Son dos años completos: **315.969 líneas de ticket** y **153.510 fotos diarias
> de góndola**, sobre treinta productos en seis sucursales.
>
> Los datos son simulados, y lo decimos de entrada. Le pusimos comportamientos
> realistas a propósito, y están documentados en el script.
>
> ¿Por qué a propósito? Porque un conjunto de datos generado al azar no tiene
> ninguna regla adentro: sería buscar huellas en una playa donde nadie caminó.
>
> Ahora bien, eso mismo nos obliga a ser más rigurosos con la validación. Y ese
> rigor es justamente uno de los puntos teóricos que vamos a mostrar.

**Transición:** *"Te paso la palabra para el modelo."* → **B**

---

## 4 · El modelo dimensional — **B** — 2:00 a 2:50

> Vender y reponer parecen lo mismo, pero son dos procesos distintos.
>
> Una venta es un evento: pasó a las tres de la tarde. El stock es una foto: al
> cierre del día había tantas unidades. Tienen distinto **grano**, así que van en
> dos tablas de hechos separadas.
>
> Lo que las une son tres dimensiones que comparten: tiempo, sucursal y producto.
> A eso se le llama **dimensiones conformadas**, y son las que permiten preguntar
> "cuánto vendimos contra cuánto ingresamos" en una sola consulta.
>
> Dos estrellas unidas por dimensiones compartidas es una **constelación**.
>
> Y fíjense en la asimetría: cajero y medio de pago están sólo del lado de las
> ventas. El ingreso de mercadería no pasa por caja. Esa asimetría es la prueba
> de que el stock es un proceso separado, y no una columna más en la tabla de
> ventas.

**Transición:** *"Hay una medida en este modelo que decide si todo funciona o no."*

---

## 5 · Semi-aditividad — **B** — 2:50 a 3:40

> Esta es la lámina más importante del trabajo.
>
> Si hay diez botellas el lunes y diez el martes, **no hay veinte botellas**. Son
> las mismas diez, fotografiadas dos veces.
>
> Las unidades vendidas sí se suman: vendiste diez y diez, vendiste veinte. Pero
> el stock no se suma en el tiempo. A eso se le dice **medida semi-aditiva**: se
> suma por sucursal y por producto, nunca por fecha.
>
> ¿Cuánto importa esto? Si uno suma mal los 731 días, le da **seis millones
> ciento cincuenta y nueve mil** unidades. El stock real en góndola es **ocho mil
> ciento sesenta y uno**.
>
> Tres órdenes de magnitud. Y el asistente de Analysis Services, si uno le da
> "siguiente" cuatro veces, lo deja mal por defecto. Hay que ir a la propiedad y
> cambiarla a mano.

*(Pausa acá. Es el número que se recuerda.)*

**Transición:** *"Te devuelvo para la parte conceptual."* → **A**

---

## 6 · De la consulta al patrón — **A** — 3:40 a 4:20

> Una aclaración conceptual, porque es fácil confundir las dos cosas.
>
> Una consulta analítica responde lo que ya sabíamos preguntar: "¿cuánto quebró
> la zona Oeste en mayo?". La pregunta ya trae la hipótesis adentro.
>
> La minería de datos es otra cosa: es encontrar lo que **no sabíamos que había
> que preguntar**. Por ejemplo, que el faltante de bebidas en el Oeste no cae el
> fin de semana. Cae el martes. Nadie lo hubiera preguntado así.
>
> Y para llegar a eso hicieron falta tres disciplinas: la gestión de bases de
> datos para el modelo y el cubo, la estadística para medir si el patrón es real,
> y la inteligencia artificial, que usamos para diseñar consultas, para que nos
> cuestionara los hallazgos y para maquetar el portal.

---

## 7 · Tipos de variables — **A** — 4:20 a 4:50

> Rápido, porque es más técnico que interesante, pero define qué operación tiene
> sentido sobre cada columna.
>
> Las **continuas** admiten cualquier valor y se promedian: importes, costos.
>
> Las **discretas numéricas** son conteos: unidades vendidas, unidades en góndola.
> No existe media unidad.
>
> Y las **categóricas** son etiquetas para agrupar: zona, categoría, proveedor.
>
> Nuestra variable objetivo es una categórica binaria: hubo quiebre o no hubo. Y
> por eso el análisis se evalúa con confianza y lift, y no con un error promedio.

---

## 8 · Proceso KDD — **A** — 4:50 a 5:30

> Las cinco fases del proceso, en una lámina.
>
> **Selección**: recortamos el modelo a las siete tablas de la perspectiva
> logística. Descartamos cajero, medio de pago y promociones, que son de otra
> perspectiva.
>
> **Preprocesamiento**: controles de integridad. Las dos tablas de hechos cierran
> exactamente en 1.372.990 unidades, así que el cruce entre ambas es real.
>
> **Transformación**: calculamos tasa de quiebre, días de cobertura y valor de
> inventario.
>
> **Minería**: extracción de reglas sobre 131.580 observaciones.
>
> **Interpretación**: validación y traducción a acciones concretas.
>
> Las dos últimas son las que tienen contenido propio, así que ahí nos detenemos.

**Transición:** *"Contales qué encontramos."* → **B**

---

## 9 · Las cuatro reglas — **B** — 5:30 a 6:20

> Cuatro reglas, y cada una tiene una acción asociada. Les cuento dos.
>
> **R1**: en zona Oeste, las bebidas quiebran el 19% de los días. Casi el doble
> de lo normal. La causa es que ahí se vende mucho más los fines de semana, pero
> la reposición se calcula sobre un día común.
>
> **R3**: los congelados en verano quiebran el 27% de los días. Casi **cuatro
> veces** más probable que en el resto del año. Mismo problema: el pedido es el
> mismo todo el año.
>
> Ese número de la derecha es el **lift**: cuántas veces más probable es el
> quiebre cuando se cumple la condición. Si diera uno, la regla no diría nada.
>
> Las otras dos: Arcor entrega cada catorce días en vez de siete, y San Justo
> tiene el problema inverso, sobrestock.

**Transición:** *"Ahora, encontrar un patrón es fácil. Lo difícil es demostrar que es real."*

---

## 10 · Validación con hold-out — **B** — 6:20 a 7:00

> Con suficientes cruces, siempre aparece alguna coincidencia llamativa. Así que
> hicimos esto:
>
> Buscamos las reglas mirando **solamente 2024**. Y después las probamos contra
> **2025**, que es un año que el análisis no había visto.
>
> Si una regla fuera casualidad de esos datos puntuales, al cambiar de año se
> caería. Ninguna se movió más de **1,3 puntos**.
>
> La prueba de que un patrón es real no es que se vea lindo en el gráfico. Es que
> sobreviva a datos que no miraste cuando lo encontraste.

**Transición:** *"Y hay un segundo control, que es el que más nos gustó."*

---

## 11 · Correlación espuria — **B** — 7:00 a 7:50

*(La lámina más fuerte. No apurarla.)*

> Miren el ranking de proveedores por faltantes. Arriba de todo está Coca-Cola,
> con 10,8%. La conclusión obvia sería: hay un problema con Coca-Cola.
>
> Pero hicimos una cosa más. Sacamos la zona Oeste del cálculo y volvimos a
> medir.
>
> Coca-Cola cae a **0,8%**. El efecto **desaparece**. Nunca fue Coca-Cola: era la
> zona. La gaseosa simplemente se vende muchísimo ahí los fines de semana, y
> arrastraba el promedio del proveedor.
>
> Con Arcor pasa exactamente lo contrario: sube de 9,7 a **11,5%**. El efecto se
> **refuerza**. Ahí sí hay un problema real, y es el ciclo de catorce días.
>
> Si hubiéramos presentado sólo la primera columna, MiniRed habría ido a
> renegociar el contrato equivocado.

**Transición:** *"¿Cuánto vale todo esto en pesos?"* → **A**

---

## 12 · Impacto — **A** — 7:50 a 8:30

> Tres números y tres decisiones.
>
> La venta perdida por faltantes, en doce meses, la estimamos en **75 millones de
> pesos**. Asumiendo un día de demanda perdida por cada día de góndola vacía.
>
> En San Justo hay cerca de **un millón** que se podría liberar, simplemente
> calibrando su reposición a lo que realmente vende: hoy tiene diez días de
> cobertura contra cuatro del resto de la cadena.
>
> Y las tres acciones: nivel objetivo diferenciado para el fin de semana en las
> bebidas del Oeste; renegociar el ciclo con Arcor o compensarlo; y recalibrar
> San Justo.

**Transición:** *"Y esto no queda en un informe. Mostrales."* → **B**

---

## 13 · Demo en vivo — **B** — 8:30 a 9:30

*(Cambiar a la ventana del portal. Cuatro movimientos, sin improvisar.)*

> Esto es lo que ve el gerente de abastecimiento.
>
> **(1)** Arriba, el estado general: cuatro indicadores con semáforo, y las tres
> alertas más urgentes. Cada alerta nombra el lugar concreto donde hay que actuar.
>
> **(2)** Filtro por zona Oeste y categoría Bebidas. *(hacerlo)* Miren: la tasa
> salta a **19,34%**. Ese es exactamente el mismo número que calculó SQL Server
> sobre los 470.000 registros originales. El navegador reagrega sumando conteos,
> no promediando porcentajes.
>
> **(3)** Este gráfico es el del efecto de arrastre: el pico no cae el fin de
> semana, cae el martes. El finde vacía la góndola y el hueco aparece después.
>
> **(4)** Y acá abajo, el control de proveedores que les mostrábamos recién, pero
> navegable.

*(Volver a la presentación.)*

**Transición:** *"Cerrá vos."* → **A**

---

## 14 · Cierre — **A** — 9:30 a 10:00

> Para cerrar, una sola idea.
>
> Salimos a buscar dónde MiniRed se quedaba sin stock. Y lo que encontramos es
> que el problema no era reponer poco: era **reponer con el parámetro
> equivocado**.
>
> MiniRed calcula cuánto reponer usando el promedio de los días hábiles. Los tres
> patrones de faltante y el de sobrestock salen todos de ese mismo supuesto.
>
> Cuatro reglas validadas, tres acciones concretas, y una correlación espuria que
> descartamos a tiempo.
>
> Con eso cerramos. Quedamos para las preguntas que quieran hacernos.

---

## Preguntas que pueden caer

**"¿Los datos son reales?"** — La base es simulada y está declarado. Pero los
números no están inventados: son el resultado de consultas reales sobre esa base.
La prueba está en la demo — el 19,34% del portal y el de SQL Server coinciden.

**"¿Por qué no usaron el motor de minería de datos de Analysis Services?"** —
Está discontinuado desde SQL Server 2022. El descubrimiento lo hicimos en la capa
analítica, con validación estadística explícita, que es lo que pide la consigna.

**"¿Y si el patrón fuera casualidad?"** — Para eso está el hold-out: las cuatro
reglas se sostienen en un año que el análisis no miró. Y el control de
correlación espuria descartó tres proveedores que parecían culpables.

**"¿Por qué San Justo aparece en rojo si tiene cero faltantes?"** — Porque tiene
el problema opuesto. Diez días de cobertura contra cuatro del resto: nunca le
falta nada porque le sobra todo. Es capital inmovilizado.

**"¿Cuánto tardaron en armar la base?"** — La generación es un script
reproducible: dos ejecuciones dan exactamente los mismos números, porque el ruido
se calcula de forma determinística sobre las claves.

**Si preguntan algo que no saben:** decirlo sin rodeos y ofrecer mostrarlo en los
datos. Es mucho mejor que improvisar: el repositorio está publicado y las
consultas son reproducibles, así que siempre se puede verificar en el momento.
