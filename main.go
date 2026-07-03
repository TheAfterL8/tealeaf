package main

import "fmt"

func addPositive(a int,b int) (int,error){
	if (a<0 || b<0) {
		return 0,fmt.Errorf("a or b are negative")
	}
	return a+b,nil
}

func main(){
	a:=-1
	b:=10
	c,err := addPositive(a,b)
	if err!=nil{
		println("Error was found")
		return
	}
	println(c);
}
