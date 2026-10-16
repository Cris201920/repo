#version 150

uniform sampler2D DiffuseSampler;

in vec2 texCoord;

out vec4 fragColor;

void main() {
    vec2 uv = texCoord;
    vec2 center = vec2(0.5, 0.5);
    vec2 delta = uv - center;

    float dist = length(delta);
    float vignette = smoothstep(0.25, 0.92, dist);

    vec4 color = texture(DiffuseSampler, uv);

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 desaturated = mix(color.rgb, vec3(gray), 0.24);

    vec3 violetShadow = vec3(0.055, 0.025, 0.095);
    vec3 crimsonGlow = vec3(0.34, 0.025, 0.045);
    vec3 royalGold = vec3(0.55, 0.25, 0.06);

    float ring1 = exp(-abs(dist - 0.62) * 18.0);
    float ring2 = exp(-abs(dist - 0.82) * 24.0);

    vec3 finalColor = desaturated;
    finalColor = mix(finalColor, finalColor * 0.78 + violetShadow, vignette * 0.34);
    finalColor += crimsonGlow * ring1 * 0.045;
    finalColor += royalGold * ring2 * 0.025;

    finalColor = (finalColor - 0.5) * 1.07 + 0.5;
    finalColor = clamp(finalColor, 0.0, 1.0);

    fragColor = vec4(finalColor, color.a);
}