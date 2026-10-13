"use strict";
const $ = id => document.getElementById(id);
    const numberFormat = new Intl.NumberFormat("en-US");
    const canvas = $("plot"), ctx = canvas.getContext("2d");
    const plot = { left:78, right:25, top:28, bottom:64 };
    let dataset = null, selectedIndices = [], gate = null, xRange = null, yRange = null, drag = null, label = "";
    const gateFields = ["xmin","xmax","ymin","ymax"];
    function status(message, error) {
      $("message").textContent = message;
      $("message").classList.toggle("error", Boolean(error));
    }
    function range(axis) { return FCS.boundsFor(dataset.events[Number($(axis).value)]); }
    function point(value, r, begin, size) { return begin + (value - r.min) / (r.max - r.min) * size; }
    function coordinates(event) {
      const rect = canvas.getBoundingClientRect();
      const px = (event.clientX - rect.left) * canvas.width / rect.width;
      const py = (event.clientY - rect.top) * canvas.height / rect.height;
      const w = canvas.width - plot.left - plot.right, h = canvas.height - plot.top - plot.bottom;
      const x = xRange.min + (Math.max(0, Math.min(1, (px - plot.left) / w))) * (xRange.max - xRange.min);
      const y = yRange.max - (Math.max(0, Math.min(1, (py - plot.top) / h))) * (yRange.max - yRange.min);
      return { x, y };
    }
    function bounds() {
      return Object.fromEntries(gateFields.map(k => [k, Number($(k).value)]));
    }
    function format(n) { return Number(n).toPrecision(6).replace(/(\.\d*?[1-9])0+(?=e|$)/, "$1").replace(/\.0+(?=e|$)/, ""); }
    function setFields(b) { for (const key of gateFields) $(key).value = String(b[key]); }
    function fullGate() { return { xmin:xRange.min, xmax:xRange.max, ymin:yRange.min, ymax:yRange.max }; }
    function applyGate() {
      if (!dataset) return;
      if (gateFields.some(k => $(k).value.trim() === "")) { status("Enter every gate bound.", true); return; }
      try {
        const b = bounds();
        selectedIndices = FCS.rectangleGate(dataset, Number($("xaxis").value), Number($("yaxis").value), b);
        gate = b;
        $("selected").textContent = numberFormat.format(selectedIndices.length);
        $("fraction").textContent = (100 * selectedIndices.length / dataset.total).toFixed(2) + "%";
        $("export").disabled = selectedIndices.length === 0;
        status("Gate applied to " + numberFormat.format(dataset.total) + " events.");
        draw();
      } catch (error) { status(error.message, true); }
    }
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0b1423"; ctx.fillRect(0,0,canvas.width,canvas.height);
      if (!dataset) { ctx.fillStyle="#b8c7db"; ctx.font="18px system-ui"; ctx.fillText("Load an FCS dataset to begin",60,88); return; }
      const w=canvas.width-plot.left-plot.right, h=canvas.height-plot.top-plot.bottom;
      ctx.strokeStyle="#2c415b"; ctx.lineWidth=1;
      for (let i=0;i<=5;i++) {
        const x=plot.left+i*w/5,y=plot.top+i*h/5;
        ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+h);ctx.moveTo(plot.left,y);ctx.lineTo(plot.left+w,y);ctx.stroke();
      }
      ctx.strokeStyle="#8ba3ba";ctx.strokeRect(plot.left,plot.top,w,h);
      ctx.fillStyle="#d1e0ef";ctx.font="17px system-ui";
      ctx.textAlign="center";ctx.fillText(dataset.channels[Number($("xaxis").value)], plot.left+w/2, canvas.height-12);
      ctx.save();ctx.translate(18, plot.top+h/2);ctx.rotate(-Math.PI/2);ctx.fillText(dataset.channels[Number($("yaxis").value)],0,0);ctx.restore();
      ctx.font="13px monospace";ctx.textAlign="center";
      for(let i=0;i<=5;i++) {
        ctx.fillText(format(xRange.min+(xRange.max-xRange.min)*i/5),plot.left+w*i/5,plot.top+h+22);
        ctx.textAlign="right";ctx.fillText(format(yRange.max-(yRange.max-yRange.min)*i/5),plot.left-8,plot.top+h*i/5+4);ctx.textAlign="center";
      }
      const xc=dataset.events[Number($("xaxis").value)],yc=dataset.events[Number($("yaxis").value)];
      const step=Math.max(1,Math.ceil(dataset.total/20000));
      for(let i=0;i<dataset.total;i+=step) {
        const x=point(xc[i],xRange,plot.left,w), y=plot.top+h-point(yc[i],yRange,0,h);
        const inside=gate && xc[i]>=gate.xmin && xc[i]<=gate.xmax && yc[i]>=gate.ymin && yc[i]<=gate.ymax;
        ctx.fillStyle=inside?"rgba(90,218,249,.65)":"rgba(164,176,192,.22)";
        ctx.fillRect(x-1.4,y-1.4,2.8,2.8);
      }
      if (gate) {
        const x0=point(gate.xmin,xRange,plot.left,w),x1=point(gate.xmax,xRange,plot.left,w);
        const y0=plot.top+h-point(gate.ymax,yRange,0,h),y1=plot.top+h-point(gate.ymin,yRange,0,h);
        ctx.strokeStyle="#77bbfa";ctx.lineWidth=2;ctx.strokeRect(x0,y0,x1-x0,y1-y0);
      }
    }
    function setAxes() {
      xRange=range("xaxis"); yRange=range("yaxis");
      setFields(fullGate()); applyGate();
    }
    function load(data,name) {
      dataset=data;label=name;
      for(const axis of ["xaxis","yaxis"]) {
        const el=$(axis);el.replaceChildren();
        data.channels.forEach((channel,i) => el.add(new Option(channel, String(i))));
        el.disabled=false;
      }
      $("yaxis").value=String(Math.min(1,data.channels.length-1));
      for(const id of gateFields.concat(["apply","reset"])) $(id).disabled=false;
      $("total").textContent=numberFormat.format(data.total);
      $("summary").textContent=name+" · "+data.version+" · "+data.channels.length+" channels · event values as stored in the file";
      setAxes();
    }
    $("file").addEventListener("change", async event => {
      const file=event.target.files[0];if(!file)return;
      if(file.size>128*1024*1024) { status("File exceeds the 128 MiB limit.",true);return; }
      status("Reading local FCS file...");
      try { load(FCS.readFCS(await file.arrayBuffer()),file.name); }
      catch(error) { status(error.message,true); }
    });
    $("demo").addEventListener("click", () => {
      const a=new Float64Array(5000),b=new Float64Array(5000);
      for(let i=0;i<a.length;i++) {
        const t=i*2.3999632297,r=Math.sqrt(i/a.length);
        const center=i%4===0?660:300;
        a[i]=center+145*r*Math.cos(t);b[i]=(i%4===0?520:250)+135*r*Math.sin(t);
      }
      load({version:"Synthetic example",channels:["FSC-A (synthetic)","SSC-A (synthetic)"],events:[a,b],total:a.length,compensated:false},"Synthetic example — not an FCS file");
    });
    $("xaxis").addEventListener("change",setAxes);
    $("yaxis").addEventListener("change",setAxes);
    $("apply").addEventListener("click",applyGate);
    $("reset").addEventListener("click",()=>{setFields(fullGate());applyGate();});
    $("export").addEventListener("click",()=>{
      if(!dataset||!selectedIndices.length)return;
      const content=FCS.csvForGate(dataset,selectedIndices);
      const url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));
      const link=document.createElement("a");link.href=url;link.download="gated-events.csv";document.body.appendChild(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    canvas.addEventListener("pointerdown", event=>{
      if(!dataset)return;
      drag=coordinates(event);canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointerup",event=>{
      if(!drag||!dataset)return;
      const end=coordinates(event),start=drag;drag=null;
      if(Math.abs(end.x-start.x)<1e-8||Math.abs(end.y-start.y)<1e-8)return;
      setFields({xmin:Math.min(start.x,end.x),xmax:Math.max(start.x,end.x),ymin:Math.min(start.y,end.y),ymax:Math.max(start.y,end.y)});
      applyGate();
    });
    canvas.addEventListener("pointercancel",()=>{drag=null;});
    draw();
