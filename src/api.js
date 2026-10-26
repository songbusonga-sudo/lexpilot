export async function api(path, options) {
  const response = await fetch("/api" + path, options);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || "操作失败，请重试");
  return data;
}
export const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const scenes = { rental: "租房", parttime: "兼职", internship: "实习" };
export const stages = ["准备签约", "正在履行", "已经发生问题"];
export const money = (cents) =>
  cents === null || cents === undefined
    ? "未填写"
    : new Intl.NumberFormat("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(cents / 100);
export const amountInput = (cents) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(2);
export function download(content, name, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
