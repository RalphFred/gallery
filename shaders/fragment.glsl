precision highp float;
uniform vec2 iResolution;
uniform vec2 iMouse;
uniform sampler2D iChannel0;
varying vec2 fragCoord;

vec2 getDistortedUv(vec2 uv, vec2 direction, float factor) {
    vec2 scaledDirection = direction;
    scaledDirection.y *= 2.0;
    return uv - scaledDirection * factor;
}

struct DistortedLens {
    vec2 uv_R;
    vec2 uv_G;
    vec2 uv_B;
    float focusSdf;
    float speherSdf;
    float inside;
};

vec2 fixRotation(vec2 uv, vec2 center) {
    vec2 centered = uv - center;
    centered.y = -centered.y;
    return centered + center;
}

DistortedLens getLensDistortion(
    vec2 p,
    vec2 uv,
    vec2 sphereCenter,
    float sphereRadius,
    float focusFactor,
    float chromaticAberrationFactor
) {
    vec2 distortionDirection = normalize(p - sphereCenter);
    float focusRadius = sphereRadius * focusFactor;
    float focusStrength = sphereRadius / 5000.0;
    float focusSdf = length(sphereCenter - p) - focusRadius;
    float speherSdf = length(sphereCenter - p) - sphereRadius;
    float inside = smoothstep(0.0, 1.0, -speherSdf / (sphereRadius * 0.001));
    
    float magnifierFactor = focusSdf / (sphereRadius - focusRadius);
    float mFactor = clamp(magnifierFactor * inside, 0.0, 1.0);
    mFactor = pow(mFactor, 5.0);
    
    vec3 distortionFactors = vec3(
        mFactor * focusStrength * (1.0 + chromaticAberrationFactor),
        mFactor * focusStrength,
        mFactor * focusStrength * (1.0 - chromaticAberrationFactor)
    );
    
    vec2 uv_R = getDistortedUv(uv, distortionDirection, distortionFactors.r);
    vec2 uv_G = getDistortedUv(uv, distortionDirection, distortionFactors.g);
    vec2 uv_B = getDistortedUv(uv, distortionDirection, distortionFactors.b);
    
    vec2 sphereCenterUv = sphereCenter / iResolution;
    uv_R = fixRotation(uv_R, sphereCenterUv);
    uv_G = fixRotation(uv_G, sphereCenterUv);
    uv_B = fixRotation(uv_B, sphereCenterUv);
    
    return DistortedLens(
        uv_R,
        uv_G,
        uv_B,
        focusSdf,
        speherSdf,
        inside
    );
}

vec2 zoomUV(vec2 uv, vec2 center, float zoom) {
    float zoomFactor = 1.0 / zoom;
    vec2 centeredUV = uv - center;
    centeredUV *= zoomFactor;
    return centeredUV + center;
}

void main() {
    vec2 p = fragCoord * iResolution;
    vec2 vUv = fragCoord;
    
    vec2 textureSize = iResolution;
    vec2 sphereCenter = iMouse.xy;
    vec2 spehereCenterUv = sphereCenter / textureSize;
    float sphereRadius = iResolution.y * 0.3;
    float focusFactor = 0.25;
    float chromaticAberrationFactor = 0.25;
    float zoom = 1.75;
    
    vec2 zoomedUv = zoomUV(vUv, spehereCenterUv, zoom);
    
    DistortedLens distortion = getLensDistortion(
        p, zoomedUv, sphereCenter, sphereRadius, focusFactor, chromaticAberrationFactor
    );

    vec4 baseTexture = texture2D(iChannel0, vUv);
    vec3 imageDistorted = vec3(
        texture2D(iChannel0, distortion.uv_R).r,
        texture2D(iChannel0, distortion.uv_G).g,
        texture2D(iChannel0, distortion.uv_B).b
    );
    
    vec3 result = mix(baseTexture.rgb, imageDistorted, distortion.inside);
    float alpha = distortion.inside;
    
    gl_FragColor = vec4(result, alpha);
}