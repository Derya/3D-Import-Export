var sitcNames;

$.get('http://josh-han.com:10002/sitcnames').done(function(data){
    sitcNames = data;
});

$('.button').click(function(){
    $('.button').removeClass('active');
    $(this).addClass('active');
});

$('.product').click(function(){
    $(this).focus();
});

$('.product').keyup(function(){
    var search = $(this).val();
    if (search == '') return;
    searchArr = search.split(' ').map(function(value){
        return value.trim();
    })
    console.log(searchArr);
});