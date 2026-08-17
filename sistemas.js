// ========================================================
// PIZARRA OESTE - sistemas.js
// Biblioteca de Jugadas Prediseñadas (Sistemas Clásicos).
// Arreglo global SISTEMAS_JUGADAS: cada elemento es una jugada lista
// para cargar en la cancha, en el mismo formato que ya usan
// exportPlay() / aplicarJugadaImportada() (ver ui.js) -campos
// a/d/b/p/u/t/s/m-, más los metadatos propios de la Biblioteca (id,
// nombre, categoria, etiqueta, descripcion) que solo usa el panel de
// abrirBibliotecaJugadas() en ui.js.
//
// Este módulo NO depende de ningún otro (es pura data) y no necesita
// que el canvas ya exista: se puede cargar en cualquier orden respecto
// de estado.js/cancha.js, siempre y cuando lo haga ANTES de que se
// intente abrir el panel (ver el <script> agregado en index.html).
//
// ¿DE DÓNDE SALE EL CAMPO "jugada" DE CADA ENTRADA? Del propio botón
// "💾 Guardar Jugada" del menú Archivo: armá la jugada arrastrando
// fichas dentro de la app -así el editor graba solo, paso por paso, el
// origen y el destino real de cada movimiento-, probala con PLAY, y
// exportala. El .json que se descarga es exactamente lo que va en este
// campo (le sacamos únicamente los campos de runtime que trae el
// archivo exportado -_pulsoSeleccionHasta, _pulsoImanHasta, ax/ay/as/aa-,
// que son del momento puntual de la exportación y no hacen falta acá).
//
// ¡IMPORTANTE SI SE EDITA UN PASO A MANO (sin pasar por la app)! Cada
// paso de un jugador/pelota (steps[i]) es un ARREGLO de puntos:
//   - Un solo punto ([{x,y,...}])            = el jugador queda QUIETO
//     durante ese paso (no genera trazado ni movimiento animado; el
//     motor -ver pathEfectivo() en cancha.js- directamente IGNORA esa
//     coordenada y lo deja anclado donde terminó el paso anterior).
//   - Dos o más puntos ([origen, ..., destino]) = el jugador SE MUEVE
//     durante ese paso: dibuja el trazado y se anima entre esos puntos
//     con Play. El primer punto es el origen (debe coincidir con el
//     destino del paso anterior) y el último es el destino real.
// Si la jugada se construyó y se exportó desde la app (recomendado),
// esto ya sale bien solo -no hace falta tocar nada de esto a mano-.
//
// PARA AGREGAR UNA JUGADA NUEVA: armala en la app, Guardar Jugada,
// pasame el .json y yo la integro acá -o copiá el bloque de "Horns A"
// de abajo como plantilla si preferís hacerlo vos mismo, dándole otro
// "id" único (interno, no se muestra). Categorías válidas para los
// filtros del panel: 'ataque' | 'zona' | 'salida'.
// ========================================================

const SISTEMAS_JUGADAS = [
    {
        id:          'horns-a',
        nombre:      'Horns A - Doble Pantalla y Penetración',
        categoria:   'ataque',
        etiqueta:    'Media Cancha • 4 Pasos',
        descripcion: 'Formación Horns: los dos postes (C y D) bajan a formar una doble pantalla central mientras las alas (A y B) se abren a las esquinas; el base (E) atraviesa las pantallas dribleando y penetra a definir cerca del aro.',

        // Jugada construida y probada en la app (Guardar Jugada), sin
        // modificar a mano -por eso cada paso con desplazamiento ya
        // viene con sus puntos de origen y destino bien encadenados-.
        jugada: {
            a: "5",
            d: "0",
            b: [
                {
                    id: "ball-0",
                    active: true,
                    team: "ball",
                    steps: [
                        [{ x: 725.8904, y: 744.7496, isScreen: false, angle: 0 }],
                        [{ x: 725.8904, y: 744.7496, isScreen: false, angle: 0 }],
                        [{ x: 725.8904, y: 744.7496, isScreen: false, angle: 0 }],
                        [{ x: 859.593525, y: 240.1096, isScreen: false, angle: 0 }]
                    ],
                    portadorPorPaso: ["red-4", "red-4", "red-4", "red-4"]
                }
            ],
            p: [
                {
                    id: "red-0",
                    team: "red",
                    steps: [
                        [{ x: 437.703125, y: 199, isScreen: false, angle: 0 }],
                        [{ x: 437.703125, y: 199, isScreen: false, angle: 0 }],
                        [{ x: 437.703125, y: 199, isScreen: false, angle: 0 }, { x: 340.703125, y: 215, isScreen: false, angle: 0 }, { x: 77.703125, y: 170, isScreen: false, angle: 0 }],
                        [{ x: 77.703125, y: 170, isScreen: false, angle: 0 }]
                    ],
                    label: "A"
                },
                {
                    id: "red-1",
                    team: "red",
                    steps: [
                        [{ x: 903.703125, y: 191, isScreen: false, angle: 0 }],
                        [{ x: 903.703125, y: 191, isScreen: false, angle: 0 }],
                        [{ x: 903.703125, y: 191, isScreen: false, angle: 0 }, { x: 988.703125, y: 201, isScreen: false, angle: 0 }, { x: 1267.703125, y: 162, isScreen: false, angle: 0 }],
                        [{ x: 1267.703125, y: 162, isScreen: false, angle: 0 }]
                    ],
                    label: "B"
                },
                {
                    id: "red-2",
                    team: "red",
                    steps: [
                        [{ x: 482.99999999999994, y: 456.96, isScreen: false, angle: 0 }],
                        [{ x: 482.99999999999994, y: 456.96, isScreen: false, angle: 0 }, { x: 518.703125, y: 635, isScreen: false, angle: 0 }, { x: 578.703125, y: 698, isScreen: true, angle: 135 }],
                        [{ x: 578.703125, y: 698, isScreen: true, angle: 135 }],
                        [{ x: 578.703125, y: 698, isScreen: false, angle: 0 }, { x: 490.703125, y: 696, isScreen: false, angle: 0 }, { x: 410.703125, y: 721, isScreen: false, angle: 0 }]
                    ],
                    label: "C"
                },
                {
                    id: "red-3",
                    team: "red",
                    steps: [
                        [{ x: 897, y: 456.96, isScreen: false, angle: 0 }],
                        [{ x: 897, y: 456.96, isScreen: false, angle: 0 }, { x: 809.703125, y: 612, isScreen: false, angle: 0 }, { x: 747.703125, y: 672, isScreen: true, angle: 45 }],
                        [{ x: 747.703125, y: 672, isScreen: true, angle: 45 }],
                        [{ x: 747.703125, y: 672, isScreen: false, angle: 0 }, { x: 757.703125, y: 587, isScreen: false, angle: 0 }, { x: 616.703125, y: 362, isScreen: false, angle: 0 }]
                    ],
                    label: "D"
                },
                {
                    id: "red-4",
                    team: "red",
                    steps: [
                        [{ x: 690, y: 780.64, isScreen: false, angle: 0 }],
                        [{ x: 690, y: 780.64, isScreen: false, angle: 0 }],
                        [{ x: 690, y: 780.64, isScreen: false, angle: 0 }],
                        [{ x: 690, y: 780.64, isScreen: false, angle: 0 }, { x: 774.703125, y: 790, isScreen: false, angle: 0 }, { x: 858.703125, y: 769, isScreen: false, angle: 0 }, { x: 903.703125, y: 605, isScreen: false, angle: 0 }, { x: 823.703125, y: 276, isScreen: false, angle: 0 }]
                    ],
                    label: "E"
                }
            ],
            u: [],
            t: 4,
            s: {
                w: 1380,
                h: 952
            },
            m: "half"
        }
    }
];
