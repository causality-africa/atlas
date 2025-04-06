(()=>{var m="https://api.causality.africa/v1",O={line:["#1f77b4","#d62728","#2ca02c","#9467bd","#ff7f0e","#17becf","#e377c2","#8c564b","#bcbd22","#7f7f7f"]},y={ONE_WEEK:24*7,TWO_WEEKS:24*14};document.addEventListener("DOMContentLoaded",async()=>{let l=document.getElementsByClassName("chart-container-wrapper");for(let t of l){let e=t.querySelector(".chart-container .chart"),a=e.dataset.chartType||"line";S.create(a,t,e).initialize()}});var S=class{static create(t,e,a){switch(t.toLowerCase()){case"line":return new L(e,a);default:throw new Error(`Unsupported chart type: ${t}`)}}},b=class{constructor(t,e){this.wrapperEl=t,this.chartEl=e,this.dataset=[],this.sources=[],this.locations={},this.regions={},this.urlParams=new URLSearchParams(window.location.search),this.locationCodes=[],this.regionCodes=[]}async initialize(){this.applyURLParams(),this.locationCodes=this.chartEl.dataset.locations.split(","),this.regionCodes=this.chartEl.dataset.regions.split(","),await this.prefetchData(),await this.setupUI(),await this.render()}applyURLParams(){throw new Error("applyURLParams method must be implemented by subclass")}updateURLParams(){throw new Error("updateURLParams method must be implemented by subclass")}async prefetchData(){throw new Error("prefetchData method must be implemented by subclass")}async setupUI(){await this.setupLocationSelectors(),this.setupExportButton()}async setupLocationSelectors(){let t=this.wrapperEl.querySelector(".selected-locations");t.innerHTML="",await Promise.all(this.regions.AF.locations.map(async e=>{let a=document.createElement("div");a.className="flex items-center p-3";let r=(await d.fetchLocations([e.location_code]))[e.location_code].name,s=document.createElement("input");s.type="checkbox",s.id=e.location_code,s.checked=this.locationCodes.includes(e.location_code),s.className="mr-3 h-4 w-4",s.addEventListener("change",async()=>await this.updateVisualization());let i=document.createElement("label");i.htmlFor=e.location_code,i.className="text-sm text-gray-600",i.textContent=r,a.appendChild(s),a.appendChild(i),t.appendChild(a)}))}setupSourceInfo(){let t=this.wrapperEl.querySelector(".sources");t&&(t.textContent=p.formatSourceList(this.sources))}setupExportButton(){let t=this.wrapperEl.querySelector(".save-chart");t&&t.addEventListener("click",()=>this.export())}export(){let t=this.wrapperEl.querySelector(".chart-container"),e={pixelRatio:5,backgroundColor:"#fff"};htmlToImage.toBlob(t,e).then(a=>{saveAs(a,`${this.chartEl.dataset.indicator}.png`)}).catch(a=>{console.error("Failed to save image",a)})}getSelectedLocations(){let t=this.wrapperEl.querySelector(".selected-locations"),e=Array.from(t.querySelectorAll("input:checked")).map(a=>a.id);return e.length==0?this.locationCodes:e}async render(){throw new Error("render method must be implemented by subclass")}async updateVisualization(){throw new Error("updateVisualization method must be implemented by subclass")}},L=class extends b{constructor(t,e){super(t,e),this.chart=null,this.indicator=this.chartEl.dataset.indicator,this.timeStart=new Date(this.chartEl.dataset.timeStart),this.timeEnd=new Date(this.chartEl.dataset.timeEnd)}applyURLParams(){let t=this.urlParams.get("start");t&&(this.chartEl.dataset.timeStart=t);let e=this.urlParams.get("end");e&&(this.chartEl.dataset.timeEnd=e);let a=this.urlParams.get("locations");a&&(this.chartEl.dataset.locations=a.split("~").join(","));let o=this.urlParams.get("regions");o&&(this.chartEl.dataset.regions=o.split("~").join(",")),console.log(this.chartEl.dataset)}updateURLParams(){this.urlParams.set("start",this.timeStart.getFullYear()),this.urlParams.set("end",this.timeEnd.getFullYear()),this.urlParams.set("locations",this.locationCodes.join("~")),this.urlParams.set("regions",this.regionCodes.join("~")),history.pushState(null,null,"?"+this.urlParams.toString())}async prefetchData(){this.regions=await d.fetchRegions(this.regionCodes)}async render(){this.chart=echarts.init(this.chartEl,null,{renderer:"svg"});let t={series:await this.generateSeries(),grid:{top:10,bottom:0,left:0,right:0,containLabel:!0},xAxis:{data:Array.from({length:this.timeEnd.getFullYear()-this.timeStart.getFullYear()+1},(e,a)=>this.timeStart.getFullYear()+a)},yAxis:{min:e=>{let a=e.max-e.min,o=Math.pow(10,Math.floor(Math.log10(a)));return Math.floor(e.min/o)*o},splitLine:{lineStyle:{type:"dashed"}}},color:O.line,tooltip:{trigger:"axis"},dataZoom:{show:!0,type:"inside",start:0,end:100}};this.chart.setOption(t),window.addEventListener("resize",()=>{this.chart.resize()}),this.setupSourceInfo()}async generateSeries(){this.locationCodes=this.getSelectedLocations();let t=await d.fetchDataPoints(this.indicator,this.timeStart,this.timeEnd,this.locationCodes);return this.dataset=t.dataset,this.sources=t.sources,this.locations=t.locations,this.dataset.map(e=>({name:e.name,type:"line",data:e.data,showSymbol:!1,endLabel:{show:!0,formatter:"{a}",distance:1,minMargin:2},labelLayout(a){return{align:"right",moveOverlap:"shiftY"}},emphasis:{focus:"series"}}))}async updateVisualization(){let t=await this.generateSeries();this.chart.setOption({series:t},{replaceMerge:["series"]}),this.updateURLParams()}},d=class{static async fetchDataPoints(t,e,a,o){let r=o.join(","),s=e.toISOString().split("T")[0],i=a.toISOString().split("T")[0],u=`/query?indicator=${t}&start=${s}&end=${i}&locations=${r}`;try{let n=await this.fetchLocations(o),f=await fetch(m+u);if(!f.ok)throw new Error(`API request failed with status ${f.status}`);let w=await f.json(),P=await this.fetchSourceInfo(w),C=0,E=[];for(let h in w)E.push({code:h,name:n[h].name,data:w[h].map(g=>g.numeric_value)}),C++;return E.sort((h,g)=>h.name.localeCompare(g.name)),{dataset:E,sources:P,locations:n}}catch(n){throw console.error("Error fetching data:",n),n}}static async fetchLocations(t){let e={};return await Promise.all(t.map(async a=>{let o="/locations/"+a,r=c.getFromCache(o);if(r){e[a]=r;return}try{let s=await fetch(m+o);if(s.ok){let i=await s.json();e[a]=i,c.saveToCache(o,i,y.TWO_WEEKS)}else throw new Error(`API request failed with status ${s.status}`)}catch(s){throw console.error(`Failed to fetch location with ${a}:`,s),s}})),e}static async fetchRegions(t){t.includes("AF")||t.push("AF");let e={};return await Promise.all(t.map(async a=>{let o="/regions/"+a,r=c.getFromCache(o);if(r){e[a]=r;return}try{let s=await fetch(m+o);if(s.ok){let i=await s.json();e[a]=i,c.saveToCache(o,i,y.TWO_WEEKS)}else throw new Error(`API request failed with status ${s.status}`)}catch(s){throw console.error(`Failed to fetch region with ${a}:`,s),s}})),e}static async fetchSourceInfo(t){let e={};Object.values(t).forEach(r=>{r.forEach(s=>{s.source_id&&(e[s.source_id]=(e[s.source_id]||0)+1)})});let a={},o=Object.keys(e);return await Promise.all(o.map(async r=>{try{let s="/sources/"+r,i=c.getFromCache(s);if(i){a[r]={...i,year:new Date(i.date).getFullYear(),frequency:e[r]};return}let u=await fetch(`${m}/sources/${r}`);if(u.ok){let n=await u.json();a[r]={...n,year:new Date(n.date).getFullYear(),frequency:e[r]},c.saveToCache(s,n,y.ONE_WEEK)}}catch(s){console.error(`Error fetching source info for ${r}:`,s)}})),Object.values(a).sort((r,s)=>s.frequency-r.frequency)}},c=class{static saveToCache(t,e,a,o=.2){try{a+=p.getRandomInt(o*a);let r={data:e,expiry:Date.now()+a*60*60*1e3};localStorage.setItem(t,JSON.stringify(r))}catch(r){r instanceof DOMException&&(r.code===22||r.code===1014||r.name==="QuotaExceededError"||r.name==="NS_ERROR_DOM_QUOTA_REACHED")&&localStorage.clear()}}static getFromCache(t){let e=localStorage.getItem(t);if(!e)return null;let a=JSON.parse(e);return Date.now()>a.expiry?(localStorage.removeItem(t),null):a.data}},p=class{static formatSourceList(t){if(!t||t.length===0)return"...";let e=a=>`${a.name} (${a.year})`;return t.length===1?e(t[0]):t.length<=3?t.map(e).join(", "):t.slice(0,3).map(e).join(", ")+", et al."}static getRandomInt(t){return Math.floor(Math.random()*t)}};})();
