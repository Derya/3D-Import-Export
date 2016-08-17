window.params = {
    format: 'all',
    sitc_id: '000000',
    country: null
}; 
var sitcNames;

$.getJSON('http://josh-han.com:10002/sitcnames').done(function(data){
    sitcNames = data;
    sitcNames.unshift({sitc_id: '000000', name: 'All', keywords: null});
});

$('.button').click(function(){
    $('.button').removeClass('active');
    $(this).addClass('active');

    $('.table-container').addClass('half-height').show();
    $('.title-container').show();

    switch($(this).text()) {
        case 'Export':
            $('#import-container').hide();
            $('#import-title-container').hide();
            $('#export-container').removeClass('half-height');
            break;
        case 'Import':
            $('#export-container').hide();
            $('#export-title-container').hide();
            $('#import-container').removeClass('half-height');
            break;
        default:
            break;
    }
    window.params.format = $(this).text().toLowerCase();
    redraw();
});

$('.product').click(function(){
    $(this).focus();
});

$('.product').keyup(function(){
    var searchResult = $('#search-result');
    var search = $(this).val();
    if (search == '') {
        searchResult.find('li').remove();
        return;
    }
    searchArr = search.split(' ').map(function(value){
        return value.trim();
    }).filter(function(value){
        return value != '';
    });
    var result = searchName(searchArr);
    searchResult.find('li').remove();
    result.forEach(function(ele){
        var li = $('<li>').html(`<span class="sitc-name-detail">${ele.name}</span> <span class="keywords">${ele.keywords || ''}</span>`).addClass('sitc-name').attr('data-id', ele.sitc_id);
        searchResult.append(li);
    });
});

function searchName(searchArr) {
    var result = sitcNames;
    if (result) {
        searchArr.forEach(function(searchWord){
            result = result.filter(function(sitcObject){
                var name = sitcObject.name;
                var keywords = sitcObject.keywords;
                if (name) name = name.toLowerCase();
                if (keywords) keywords = keywords.toLowerCase();
                return `${name} ${keywords}`.indexOf(searchWord.toLowerCase()) != -1;
            });
        });
    }
    return result;
}

$('#control-panel').on('click', '.sitc-name', function(){
    $('#search-result').find('li').remove();
    var sitcId = $(this).data('id');
    var sitcName = $(this).find('.sitc-name-detail').text();
    $('#product-name').text(sitcName);
    $('.product').val('');
    window.params.sitc_id = sitcId;
    redraw();
})

function redraw() {
    $('#magic').click();
}