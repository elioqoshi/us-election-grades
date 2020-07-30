function renderUSMapGrid({ el, dataURL }) {
  let stateData, usStates, usGrid, containerWidth;
  const breakpoint = 540;

  const container = d3.select(el).classed("us-map-grid", true);
  const gridSVG = container
    .append("svg")
    .attr("class", "grid-svg")
    .style("display", "none");
  const mapSVG = container
    .append("svg")
    .attr("class", "map-svg")
    .style("display", "none");
  const legend = container.append("div");
  const tooltip = (() => {
    let tooltipBox;
    const tooltip = container
      .append("div")
      .attr("class", "tooltip-container hidden");
    function show(content) {
      tooltip.html(content).classed("hidden", false);
      tooltipBox = tooltip.node().getBoundingClientRect();
    }
    function move() {
      let [x, y] = d3.mouse(el);
      x += 5;
      if (x + tooltipBox.width > containerWidth) {
        x -= tooltipBox.width + 10;
      }
      y -= tooltipBox.height + 5;
      if (y - tooltipBox.height < 0) {
        y += tooltipBox.height + 10;
      }
      tooltip.style("transform", `translate(${x}px,${y}px)`);
    }
    function hide() {
      tooltip.classed("hidden", true);
    }
    return {
      show,
      move,
      hide,
    };
  })();

  const scores = ["A", "B", "C", "D", "F"];
  const color = d3
    .scaleOrdinal()
    .domain(scores)
    .range(scores.map((d) => `score-${d.toLowerCase()}`));

  const dispatch = d3.dispatch("gradehover", "gradehighlight");

  d3.json(dataURL)
    .then((data) => {
      data.forEach((d) => {
        d.id = +d.id < 10 ? `0${d.id}` : `${d.id}`;
      });
      stateData = new Map(data.map((d) => [d.abbreviation, d]));
      resize();
      legend.call(renderLegend, color, "Grade", dispatch);
      window.addEventListener("resize", resize);
    })
    .catch((err) => {
      console.error(err);
      container.html("Something went wrong, please try again later.");
    });

  function resize() {
    containerWidth = el.clientWidth;
    if (containerWidth < breakpoint) {
      gridSVG.style("display", "block");
      mapSVG.style("display", "none");
      if (!usGrid) {
        usGrid = getUSGrid();
      }
      gridSVG.call(
        renderUSGrid,
        stateData,
        usGrid,
        containerWidth,
        color,
        dispatch
      );
    } else {
      mapSVG.style("display", "block");
      gridSVG.style("display", "none");
      if (usStates) {
        mapSVG.call(
          renderUSMap,
          stateData,
          usStates,
          containerWidth,
          color,
          dispatch
        );
      } else {
        const idToAbbr = new Map(
          [...stateData.values()].map((d) => [d.id, d.abbreviation])
        );
        d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
          .then((us) => {
            usStates = topojson.feature(us, us.objects.states);
            usStates.features = usStates.features.filter((d) => {
              if (idToAbbr.has(d.id)) {
                d.properties.abbr = idToAbbr.get(d.id);
                return true;
              }
              return false;
            });
            mapSVG.call(
              renderUSMap,
              stateData,
              usStates,
              containerWidth,
              color,
              dispatch
            );
          })
          .catch((err) => {
            console.error(err);
            gridSVG.call(
              renderUSGrid,
              stateData,
              usGrid,
              containerWidth,
              color,
              dispatch
            );
          });
      }
    }
  }

  function renderUSGrid(
    svg,
    stateData,
    usGrid,
    containerWidth,
    color,
    dispatch
  ) {
    const margin = { top: 1, right: 1, bottom: 1, left: 1 };
    (gridWidth = d3.max(usGrid, (d) => d.x) + 1),
      (gridHeight = d3.max(usGrid, (d) => d.y) + 1),
      (cellSize = Math.floor(
        (containerWidth - margin.left - margin.right) / gridWidth
      )),
      (height = cellSize * gridHeight + margin.top + margin.bottom);
    svg.attr("viewBox", [0, 0, containerWidth, height]);
    const g = svg
      .selectAll(".grid-g")
      .data([0])
      .join("g")
      .attr("class", "grid-g")
      .attr("transform", `translate(${containerWidth / 2},${height / 2})`);
    const stateGrid = g
      .selectAll(".state-grid")
      .data(usGrid, (d) => d.abbr)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "state-grid")
          .call((g) =>
            g
              .append("rect")
              .attr(
                "class",
                (d) => `state-grid-rect ${color(stateData.get(d.abbr).grade)}`
              )
          )
          .call((g) =>
            g
              .append("text")
              .attr(
                "class",
                (d) => `state-grid-label ${color(stateData.get(d.abbr).grade)}`
              )
              .attr("dy", "0.32em")
              .attr("text-anchor", "middle")
              .text((d) => d.abbr)
          )
      )
      .attr(
        "transform",
        (d) =>
          `translate(${(d.x - gridWidth / 2 + 0.5) * cellSize},${
            (d.y - gridHeight / 2 + 0.5) * cellSize
          })`
      )
      .call((g) =>
        g
          .select(".state-grid-rect")
          .attr("x", -cellSize / 2)
          .attr("y", -cellSize / 2)
          .attr("width", cellSize)
          .attr("height", cellSize)
      )
      .on("mouseenter", function (d) {
        d3.select(this).raise();
        stateGrid.classed("inactive", (e) => d !== e);
        dispatch.call("gradehighlight", null, stateData.get(d.abbr).grade);
      })
      .on("mouseleave", () => {
        stateGrid.classed("inactive", false);
        dispatch.call("gradehighlight", null, null);
      });

    dispatch.on("gradehover", (grade) => {
      if (grade) {
        stateGrid
          .classed("inactive", (e) => stateData.get(e.abbr).grade !== grade)
          .sort((a, b) => {
            const aV = stateData.get(a.abbr).grade === grade ? 1 : -1;
            const bV = stateData.get(b.abbr).grade === grade ? 1 : -1;
            return d3.ascending(aV, bV);
          });
      } else {
        stateGrid.classed("inactive", false);
      }
    });
  }

  function renderUSMap(
    svg,
    stateData,
    usStates,
    containerWidth,
    color,
    dispatch
  ) {
    const margin = {
      top: 1,
      right: 100,
      bottom: 1,
      left: 1,
    };
    const sideStateWidth = 52;
    const sideStateHeight = 24;
    const width = containerWidth - margin.left - margin.right;
    const projection = d3.geoAlbersUsa().fitWidth(width, usStates);
    const path = d3.geoPath(projection);
    const height = Math.ceil(path.bounds(usStates)[1][1]);

    svg.attr("viewBox", [
      0,
      0,
      containerWidth,
      height + margin.top + margin.bottom,
    ]);
    const g = svg
      .selectAll(".map-g")
      .data([0])
      .join("g")
      .attr("class", "map-g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
    const statePath = g
      .selectAll(".state-path")
      .data(usStates.features, (d) => d.properties.abbr)
      .join("path")
      .attr(
        "class",
        (d) =>
          `state-path ${
            stateData.get(d.properties.abbr)
              ? color(stateData.get(d.properties.abbr).grade)
              : ""
          }`
      )
      .attr("d", path)
      .on("mouseenter", function (d) {
        d3.select(this).raise();
        statePath.classed("inactive", (e) => e !== d);
        sideState.classed("inactive", (e) => e !== d.properties.abbr);
        const s = stateData.get(d.properties.abbr);
        const content = getTooltipContent(s);
        tooltip.show(content);
        dispatch.call("gradehighlight", null, s.grade);
      })
      .on("mousemove", tooltip.move)
      .on("mouseleave", () => {
        tooltip.hide();
        statePath.classed("inactive", false);
        sideState.classed("inactive", false);
        dispatch.call("gradehighlight", null, null);
      })
      .on("click", (d) => navigateToStateDetailsPage(d.properties.abbr));
    const sideState = g
      .selectAll(".side-state")
      .data(["VT", "NH", "CT", "RI", "DE", "MD", "DC"], (d) => d)
      .join((enter) =>
        enter
          .append("g")
          .attr("class", "side-state")
          .call((g) =>
            g
              .append("rect")
              .attr(
                "class",
                (d) => `side-state-rect ${color(stateData.get(d).grade)}`
              )
              .attr("width", sideStateWidth)
              .attr("height", sideStateHeight)
          )
          .call((g) =>
            g
              .append("text")
              .attr(
                "class",
                (d) => `side-state-label ${color(stateData.get(d).grade)}`
              )
              .attr("y", sideStateHeight / 2)
              .attr("x", sideStateWidth / 2)
              .attr("dy", "0.32em")
              .attr("text-anchor", "middle")
              .text((d) => d)
          )
      )
      .attr(
        "transform",
        (d, i) =>
          `translate(${width + margin.right - sideStateWidth - 1},${
            10 + sideStateHeight * 1.5 * i
          })`
      )
      .on("mouseenter", function (d) {
        statePath
          .classed("inactive", (e) => e.properties.abbr !== d)
          .filter((e) => e.properties.abbr === d)
          .raise();
        sideState.classed("inactive", (e) => e !== d);
        const s = stateData.get(d);
        const content = getTooltipContent(s);
        tooltip.show(content);
        dispatch.call("gradehighlight", null, s.grade);
      })
      .on("mousemove", tooltip.move)
      .on("mouseleave", () => {
        tooltip.hide();
        statePath.classed("inactive", false);
        sideState.classed("inactive", false);
        dispatch.call("gradehighlight", null, null);
      })
      .on("click", (d) => navigateToStateDetailsPage(d));

    dispatch.on("gradehover", (grade) => {
      if (grade) {
        statePath
          .classed(
            "inactive",
            (e) => stateData.get(e.properties.abbr).grade !== grade
          )
          .sort((a, b) => {
            const aV =
              stateData.get(a.properties.abbr).grade === grade ? 1 : -1;
            const bV =
              stateData.get(b.properties.abbr).grade === grade ? 1 : -1;
            return d3.ascending(aV, bV);
          });
        sideState.classed("inactive", (e) => stateData.get(e).grade !== grade);
      } else {
        statePath.classed("inactive", false);
        sideState.classed("inactive", false);
      }
    });

    function getTooltipContent(s) {
      return `
          <div class="tooltip-header">${s.name} (${s.abbreviation})</div>
          <div class="tooltip-body">Grade: ${s.grade}</div>
        `;
    }

    function navigateToStateDetailsPage(abbr) {
      window.open(`https://election-audits.org/state/${abbr}`, "statedetail");
    }
  }

  function renderLegend(legend, color, title, dispatch) {
    legend.classed("legend-container", true);
    legend.append("div").attr("class", "legend-title").text(title);
    const item = legend
      .selectAll(".legend-item")
      .data(color.domain())
      .join("div")
      .attr("class", "legend-item")
      .call((item) =>
        item.append("div").attr("class", (d) => `legend-swatch ${color(d)}`)
      )
      .call((item) =>
        item
          .append("div")
          .attr("class", "legend-label")
          .text((d) => d)
      )
      .on("mouseenter", (d) => {
        item.classed("inactive", (e) => d !== e);
        dispatch.call("gradehover", null, d);
      })
      .on("mouseleave", () => {
        item.classed("inactive", false);
        dispatch.call("gradehover", null, null);
      });
    dispatch.on("gradehighlight", (grade) => {
      if (grade) {
        item.classed("inactive", (d) => d !== grade);
      } else {
        item.classed("inactive", false);
      }
    });
  }

  function getUSGrid() {
    return [
      { abbr: "ME", y: 0, x: 10 },
      { abbr: "WI", y: 1, x: 5 },
      { abbr: "VT", y: 1, x: 9 },
      { abbr: "NH", y: 1, x: 10 },
      { abbr: "WA", y: 2, x: 0 },
      { abbr: "ID", y: 2, x: 1 },
      { abbr: "MT", y: 2, x: 2 },
      { abbr: "ND", y: 2, x: 3 },
      { abbr: "MN", y: 2, x: 4 },
      { abbr: "IL", y: 2, x: 5 },
      { abbr: "MI", y: 2, x: 6 },
      { abbr: "NY", y: 2, x: 8 },
      { abbr: "MA", y: 2, x: 9 },
      { abbr: "OR", y: 3, x: 0 },
      { abbr: "NV", y: 3, x: 1 },
      { abbr: "WY", y: 3, x: 2 },
      { abbr: "SD", y: 3, x: 3 },
      { abbr: "IA", y: 3, x: 4 },
      { abbr: "IN", y: 3, x: 5 },
      { abbr: "OH", y: 3, x: 6 },
      { abbr: "PA", y: 3, x: 7 },
      { abbr: "NJ", y: 3, x: 8 },
      { abbr: "CT", y: 3, x: 9 },
      { abbr: "RI", y: 3, x: 10 },
      { abbr: "CA", y: 4, x: 0 },
      { abbr: "UT", y: 4, x: 1 },
      { abbr: "CO", y: 4, x: 2 },
      { abbr: "NE", y: 4, x: 3 },
      { abbr: "MO", y: 4, x: 4 },
      { abbr: "KY", y: 4, x: 5 },
      { abbr: "WV", y: 4, x: 6 },
      { abbr: "VA", y: 4, x: 7 },
      { abbr: "MD", y: 4, x: 8 },
      { abbr: "DE", y: 4, x: 9 },
      { abbr: "AZ", y: 5, x: 1 },
      { abbr: "NM", y: 5, x: 2 },
      { abbr: "KS", y: 5, x: 3 },
      { abbr: "AR", y: 5, x: 4 },
      { abbr: "TN", y: 5, x: 5 },
      { abbr: "NC", y: 5, x: 6 },
      { abbr: "SC", y: 5, x: 7 },
      { abbr: "DC", y: 5, x: 8 },
      { abbr: "OK", y: 6, x: 3 },
      { abbr: "LA", y: 6, x: 4 },
      { abbr: "MS", y: 6, x: 5 },
      { abbr: "AL", y: 6, x: 6 },
      { abbr: "GA", y: 6, x: 7 },
      { abbr: "HI", y: 7, x: 0 },
      { abbr: "AK", y: 7, x: 1 },
      { abbr: "TX", y: 7, x: 3 },
      { abbr: "FL", y: 7, x: 8 },
    ];
  }
}
