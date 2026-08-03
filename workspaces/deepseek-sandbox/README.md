# DeepSeek Sandbox

这是一个干净的示例工作区，供 WebUI 中的 DeepSeek coding agent 读写代码。它和 harness 项目源码分离，适合演示“查看文件 -> 修改代码 -> 运行测试 -> 总结结果”的完整链路。

## 本地验证

```powershell
npm test
npm run build
```

当前项目预留了排序函数入口。你可以在 WebUI 中尝试：

```text
请实现冒泡排序，并运行测试验证
```
