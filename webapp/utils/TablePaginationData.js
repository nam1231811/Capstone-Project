sap.ui.define([], function () {
    "use strict";

    return {
        onPressLoadMore: function () {
            // "this" ở đây sẽ được trỏ từ Controller sang nhờ hàm .call(this)
            const oDisplayModel = this.getView().getModel("displayModel");
            const iDataLength = oDisplayModel.getProperty("/Data").length;
            
            let iCurrentRowCount = oDisplayModel.getProperty("/visibleRowCount");
            let iNewRowCount = iCurrentRowCount + 5; // Tăng thêm 5 dòng
            
            if (iNewRowCount >= iDataLength) {
                iNewRowCount = iDataLength;
                oDisplayModel.setProperty("/hasMore", false); 
            }
            
            oDisplayModel.setProperty("/visibleRowCount", iNewRowCount);
            oDisplayModel.setProperty("/hasLess", true);
        },

        onPressShowLess: function () {
            const oDisplayModel = this.getView().getModel("displayModel");
            const iDataLength = oDisplayModel.getProperty("/Data").length;
            
            // Trả về mặc định 10 dòng
            const iDefaultRowCount = iDataLength < 10 ? iDataLength : 10;
            
            oDisplayModel.setProperty("/visibleRowCount", iDefaultRowCount);
            oDisplayModel.setProperty("/hasLess", false); // Ẩn nút Show Less
            oDisplayModel.setProperty("/hasMore", iDataLength > iDefaultRowCount); // Hiện lại nút Show More
        }
    };
});