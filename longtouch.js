/**
 * @file DOM长按指令
 * @date 2022-07-22
 * @author Perfumere
 */

const longtouch = {
    install(app) {
        app.directive('longtouch', (el, binding) => {
            const { value, arg = 400 } = binding;
            let timer = null;

            if (typeof value !== 'function') {
                return;
            }

            function startTouch() {
                timer = setTimeout(value, arg);
            }
            function cancelTouch() {
                clearTimeout(timer);
            }

            if (el.__bindLongTouch) {
                el.removeEventListener('touchstart', startTouch);
                el.removeEventListener('touchmove', cancelTouch);
                el.removeEventListener('touchend', cancelTouch);
                el.removeEventListener('touchcancel', cancelTouch);

                return;
            }

            el.__bindLongTouch = true;
            el.addEventListener('touchstart', startTouch);
            el.addEventListener('touchmove', cancelTouch);
            el.addEventListener('touchend', cancelTouch);
            el.addEventListener('touchcancel', cancelTouch);
        });
    }
};

module.exports = {
    longtouch
};
