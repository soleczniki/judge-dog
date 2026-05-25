import puppeteer from "puppeteer";
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const browser = await puppeteer.launch({ headless:true, args:["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto("https://www.fci.be/en/judges/Judge.aspx?id=3", { waitUntil:"networkidle2", timeout:25000 });
  await sleep(1000);

  const groups = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll("[id*='BogCheckBox']").forEach(cb => {
      // Walk up to find the group label (the <i fa-plus> text node nearby)
      let el = cb;
      let groupLabel = "";
      for (let i = 0; i < 6; i++) {
        el = el.parentElement;
        if (!el) break;
        const text = el.innerText || "";
        const m = text.match(/(\d+)\s*[-–]\s*([^\n]+)/);
        if (m) { groupLabel = `Group ${m[1]} — ${m[2].trim()}`; break; }
      }
      result.push({ id: cb.id.split("_").pop(), checked: cb.checked, label: groupLabel });
    });
    return result;
  });
  console.log("Judge 3 groups:");
  groups.forEach(g => console.log(` ${g.checked ? "✅" : "⬜"} idx=${g.id} → ${g.label}`));

  await browser.close();
}
main().catch(e => console.error(e));
