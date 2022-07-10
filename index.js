/**
 * @file Vue3环境插件
 * @date 2022-07-10
 * @author Perfumere
 */

function __touchmoveCb(event) {
    if (this.offsetHeight < this.scrollHeight) {
        event._isScroller = true;
    }
}

function __touchstartCb() {
    if (this.scrollTop === 0) {
        this.scrollTop = 1;
    }
}

const scroller = {
    install(app) {
        app.directive('scroll', (el, binding) => {
            const { value } = binding;

            if (el.__bindScroll) {
                if (value || value === undefined) {
                    return;
                }

                el.__bindScroll = undefined;
                el.removeEventListener('touchstart', __touchstartCb);
                el.removeEventListener('touchmove', __touchmoveCb);

                return;
            }

            if (value || value === undefined) {
                el.__bindScroll = true;
                el.addEventListener('touchstart', __touchstartCb);
                el.addEventListener('touchmove', __touchmoveCb);
            }
        });
    }
}

module.exports = {
    scroller
};
