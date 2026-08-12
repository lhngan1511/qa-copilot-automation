import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import createApp from "./src/server/createApp.js";
const t = fs.mkdtempSync(path.join(os.tmpdir(), "fb3-"));
const app = createApp({ repositoryType: "file", dataDir: path.join(t,"d"), outputDir: path.join(t,"o"), v3OutputDir: path.join(t,"out") });
const srv = await new Promise(r => { const s = app.listen(0,"127.0.0.1",()=>r(s)); });
const BASE = `http://127.0.0.1:${srv.address().port}/api/automation-v3`;
async function req(m,p,b){const r=await fetch(BASE+p,{method:m,headers:b!==undefined?{'content-type':'application/json'}:{},body:b!==undefined?JSON.stringify(b):undefined});let d;try{d=await r.json()}catch{d=null}return{status:r.status,body:d};}
const TC=[{id:"TC001",title:"Sửa",module:"ĐVT",type:"POSITIVE",reviewStatus:"APPROVED",expectedResult:"OK",testData:{fields:{}}}];
const c=await req("POST","/workspaces",{source:"NEW",module:"ĐVT",approvedTestCases:TC});
const wid=c.body.workspaceId;
await req("POST",`/workspaces/${wid}/testcases/TC001/select`);
// Nội dung có cả nháy đơn + nháy kép (giống Playwright thật)
const SRC = "await page.goto('http://x');\nawait page.getByRole('textbox', { name: \"Mã\" }).fill('ABC');\nawait page.getByRole('button', { name: 'Lưu' }).click();";
const st=await req("POST",`/workspaces/${wid}/recordings/start`,{type:"TESTCASE"});
const stop=await req("POST",`/workspaces/${wid}/recordings/stop`,{recordingId:st.body.recordingId,source:SRC});
console.log("stop:", stop.status, "| stepCount:", stop.body?.stepCount, "| parseError:", JSON.stringify(stop.body?.parseError ?? ""));
const detail=await req("GET",`/workspaces/${wid}/recordings/${st.body.recordingId}`);
console.log("detail steps:", detail.body?.steps?.length);
// Kiểm tra source lưu trong recording có đúng không
const raw=JSON.parse(fs.readFileSync(path.join(t,"d","codegen-recordings.json"),"utf8"));
const rec=raw.recordings.find(r=>r.recordingId===st.body.recordingId);
console.log("persisted source:", JSON.stringify(rec?.scriptContent?.slice(0,80)));
await new Promise(r=>srv.close(r)); fs.rmSync(t,{recursive:true,force:true});
