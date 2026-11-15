/**
 * 本平台（酸橙云 Web）在 UserCenter 注册的 OAuth 客户端标识。
 *
 * 三处用途必须保持同一个值：
 * 1. 所有 UC 请求统一携带 `UC-Client-Id` 头（见 request.ts）；登录 / 注册会据此写入会话的
 *    来源客户端，用户自助面接口（用户配置、自定义令牌等）按它隔离数据。
 * 2. 会话签发后无法补写来源客户端，所以登录入口必须带；老会话缺失时由具体接口显式补 `client_id`。
 * 3. 自定义令牌直签（POST /user/oauth/custom-tokens）的目标客户端，签发范围以该客户端的登记范围
 *    为上限 —— 超出会返回 90003「scope 不能超出凭证已有权限」。
 */
export const UC_CLIENT_ID = 'this_land_cloud'
